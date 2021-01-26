module View3d.RendererScene3d exposing
    ( MaterialSpec
    , Mesh
    , Options
    , Scene
    , VertexSpec
    , indexedTriangles
    , lines
    , triangles
    , view
    )

import Angle
import Array
import Camera3d
import Color
import Direction3d
import Html exposing (Html)
import Length exposing (Meters)
import LineSegment3d
import Math.Matrix4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3)
import Pixels
import Point3d exposing (Point3d)
import Quantity exposing (Unitless)
import Scene3d
import Scene3d.Material as Material
import Scene3d.Mesh
import Set exposing (Set)
import Triangle3d
import TriangularMesh
import Vector3d exposing (Vector3d)
import View3d.Camera as Camera
import Viewpoint3d



-- The mesh type and mesh generating functions are placeholders for now


type WorldCoordinates
    = WorldCoordinates


type Mesh
    = Lines (Scene3d.Mesh.Plain WorldCoordinates)
    | Triangles (Scene3d.Mesh.Uniform WorldCoordinates)


type alias Model a b =
    { a
        | size : { width : Float, height : Float }
        , scene : Scene b
        , selected : Set ( Int, Int )
        , center : Vec3
        , radius : Float
        , cameraState : Camera.State
    }


type alias VertexSpec =
    { position : Vec3
    , normal : Vec3
    }


asPointInInches : Vec3 -> Point3d Meters coordinates
asPointInInches p =
    Point3d.inches (Vec3.getX p) (Vec3.getY p) (Vec3.getZ p)


asUnitlessDirection : Vec3 -> Vector3d Unitless coordinates
asUnitlessDirection p =
    Vector3d.unitless (Vec3.getX p) (Vec3.getY p) (Vec3.getZ p)


lines : List ( VertexSpec, VertexSpec ) -> Mesh
lines =
    List.map
        (\( p, q ) ->
            LineSegment3d.from
                (asPointInInches p.position)
                (asPointInInches q.position)
        )
        >> Scene3d.Mesh.lineSegments
        >> Lines


triangles : List ( VertexSpec, VertexSpec, VertexSpec ) -> Mesh
triangles =
    List.map
        (\( p, q, r ) ->
            Triangle3d.from
                (asPointInInches p.position)
                (asPointInInches q.position)
                (asPointInInches r.position)
        )
        >> Scene3d.Mesh.facets
        >> Triangles


indexedTriangles : List VertexSpec -> List ( Int, Int, Int ) -> Mesh
indexedTriangles vertices faces =
    let
        verts =
            vertices
                |> List.map
                    (\v ->
                        { position = asPointInInches v.position
                        , normal = asUnitlessDirection v.normal
                        }
                    )
                |> Array.fromList
    in
    TriangularMesh.indexed verts faces
        |> Scene3d.Mesh.indexedFaces
        |> Triangles


type alias MaterialSpec =
    { ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Scene a =
    List
        { a
            | mesh : Mesh
            , wireframe : Mesh
            , material : MaterialSpec
            , transform : Mat4
            , idxMesh : Int
            , idxInstance : Int
        }


type alias Options =
    { orthogonalView : Bool
    , drawWires : Bool
    , fadeToBackground : Float
    , fadeToBlue : Float
    , backgroundColor : Vec3
    , addOutlines : Bool
    , outlineColor : Vec3
    }


pyramidMesh : Scene3d.Mesh.Uniform WorldCoordinates
pyramidMesh =
    let
        -- Define the vertices of our pyramid
        frontLeft =
            Point3d.centimeters 10 10 0

        frontRight =
            Point3d.centimeters 10 -10 0

        backLeft =
            Point3d.centimeters -10 10 0

        backRight =
            Point3d.centimeters -10 -10 0

        tip =
            Point3d.centimeters 0 0 10

        triangularMesh =
            TriangularMesh.indexed
                (Array.fromList
                    [ frontLeft -- 0
                    , frontRight -- 1
                    , backLeft -- 2
                    , backRight -- 3
                    , tip -- 4
                    ]
                )
                [ ( 1, 0, 4 ) -- front
                , ( 0, 2, 4 ) -- left
                , ( 2, 3, 4 ) -- back
                , ( 3, 1, 4 ) -- right
                , ( 1, 3, 0 ) -- bottom
                , ( 0, 3, 2 ) -- bottom
                ]
    in
    Scene3d.Mesh.indexedFacets triangularMesh


convertCamera : Camera.State -> Camera3d.Camera3d Length.Meters coordinates
convertCamera camState =
    let
        fowy =
            Camera.verticalFieldOfView camState
                |> Angle.degrees

        focalPoint =
            Camera.focalPoint camState
                |> asPointInInches

        eyePoint =
            Camera.eyePoint camState
                |> asPointInInches

        upDirection =
            Camera.upDirection camState
                |> asPointInInches
                |> Direction3d.from Point3d.origin
                |> Maybe.withDefault Direction3d.positiveY
    in
    Camera3d.perspective
        { viewpoint =
            Viewpoint3d.lookAt
                { focalPoint = focalPoint
                , eyePoint = eyePoint
                , upDirection = upDirection
                }
        , verticalFieldOfView = fowy
        }


view : List (Html.Attribute msg) -> Model a b -> Options -> Html msg
view attr model options =
    let
        -- Create an entity from a mesh. This is a cheap operation, so you can
        -- do things like dynamically change the material applied to mesh from
        -- frame to frame.
        pyramidEntity =
            Scene3d.mesh (Material.matte Color.blue) pyramidMesh
    in
    Scene3d.sunny
        { entities = [ pyramidEntity ]
        , camera = convertCamera model.cameraState
        , upDirection = Direction3d.z
        , sunlightDirection = Direction3d.yz (Angle.degrees -120)
        , background = Scene3d.transparentBackground
        , clipDepth = Length.centimeters 1
        , shadows = False
        , dimensions =
            ( Pixels.int (floor model.size.width)
            , Pixels.int (floor model.size.height)
            )
        }
