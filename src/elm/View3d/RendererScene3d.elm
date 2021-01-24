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
import Length
import Math.Matrix4 exposing (Mat4)
import Math.Vector3 exposing (Vec3)
import Pixels
import Point3d
import Scene3d
import Scene3d.Material as Material
import Scene3d.Mesh as Mesh
import Set exposing (Set)
import TriangularMesh
import View3d.Camera as Camera
import Viewpoint3d



-- The mesh type and mesh generating functions are placeholders for now


type WorldCoordinates
    = WorldCoordinates


type alias Mesh attributes =
    List attributes


type alias Model a b =
    { a
        | size : { width : Float, height : Float }
        , scene : Scene b
        , selected : Set ( Int, Int )
        , center : Vec3
        , radius : Float
        , cameraState : Camera.State
    }


lines : List ( attributes, attributes ) -> Mesh attributes
lines xs =
    []


triangles : List ( attributes, attributes, attributes ) -> Mesh attributes
triangles xs =
    []


indexedTriangles : List attributes -> List ( Int, Int, Int ) -> Mesh attributes
indexedTriangles xs ys =
    []


type alias VertexSpec =
    { pos : Vec3
    , normal : Vec3
    }


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
            | mesh : Mesh VertexSpec
            , wireframe : Mesh VertexSpec
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


pyramidMesh : Mesh.Uniform WorldCoordinates
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
    Mesh.indexedFacets triangularMesh


view : List (Html.Attribute msg) -> Model a b -> Options -> Html msg
view attr model options =
    let
        -- Create an entity from a mesh. This is a cheap operation, so you can
        -- do things like dynamically change the material applied to mesh from
        -- frame to frame.
        pyramidEntity =
            Scene3d.mesh (Material.matte Color.blue) pyramidMesh

        camera =
            Camera3d.perspective
                { viewpoint =
                    Viewpoint3d.lookAt
                        { focalPoint = Point3d.origin
                        , eyePoint = Point3d.centimeters 40 20 30
                        , upDirection = Direction3d.z
                        }
                , verticalFieldOfView = Angle.degrees 30
                }
    in
    Scene3d.sunny
        { entities = [ pyramidEntity ]
        , camera = camera
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
