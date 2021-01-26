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
import Axis3d
import Camera3d
import Color
import Direction3d
import Html exposing (Html)
import Length exposing (Meters)
import LineSegment3d
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Pixels
import Plane3d
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
import WebGL exposing (entity)
import Point3d exposing (coordinates)



-- The mesh type and mesh generating functions are placeholders for now


type WorldCoordinates
    = WorldCoordinates


type Mesh
    = Lines (Scene3d.Mesh.Plain WorldCoordinates)
    | Triangles (Scene3d.Mesh.Uniform WorldCoordinates)


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


type alias Model a b =
    { a
        | size : { width : Float, height : Float }
        , scene : Scene b
        , selected : Set ( Int, Int )
        , center : Vec3
        , radius : Float
        , cameraState : Camera.State
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


determinant3d : Mat4 -> Float
determinant3d mat =
    let
        r =
            Mat4.toRecord mat
    in
    0
        + (r.m11 * (r.m22 * r.m33 - r.m23 * r.m32))
        + (r.m12 * (r.m23 * r.m31 - r.m21 * r.m33))
        + (r.m13 * (r.m21 * r.m32 - r.m22 * r.m31))


rotationAngle : Mat4 -> Vec3 -> Angle.Angle
rotationAngle mat v =
    Mat4.transform mat v
        |> Vec3.dot v
        |> Angle.acos


rotationAxis : Mat4 -> Vec3 -> Axis3d.Axis3d Meters coordinates
rotationAxis mat v =
    Mat4.transform mat v
        |> Vec3.cross v
        |> Vec3.normalize
        |> asPointInInches
        |> Axis3d.throughPoints Point3d.origin
        |> Maybe.withDefault Axis3d.x


analyzeRotation :
    Mat4
    -> { axis : Axis3d.Axis3d Meters coordinatesF, angle : Angle.Angle }
analyzeRotation mat =
    let
        v =
            if Angle.inDegrees (rotationAngle mat (vec3 1 0 0)) > 1 then
                vec3 1 0 0

            else
                vec3 0 1 0
    in
    { axis = rotationAxis mat v, angle = rotationAngle mat v }


analyzeMatrix :
    Mat4
    ->
        { shift : Vector3d Meters coordinates
        , mirrorZ : Bool
        , axis : Axis3d.Axis3d Meters coordinates
        , angle : Angle.Angle
        }
analyzeMatrix mat0 =
    let
        shift =
            vec3 0 0 0
                |> Mat4.transform mat0

        mat1 =
            Mat4.translate (Vec3.negate shift) mat0

        shiftVector =
            shift
                |> asPointInInches
                |> Vector3d.from Point3d.origin

        mirrorZ =
            determinant3d mat1 < 0

        mat2 =
            if mirrorZ then
                Mat4.mul mat1 <| Mat4.makeScale3 1 1 -1

            else
                mat1

        { axis, angle } =
            analyzeRotation mat2
    in
    { shift = shiftVector, mirrorZ = mirrorZ, axis = axis, angle = angle }


applyTransform :
    Mat4
    -> Scene3d.Entity coordinates
    -> Scene3d.Entity coordinates
applyTransform mat entity =
    let
        spec =
            analyzeMatrix mat

        e0 =
            if spec.mirrorZ then
                Scene3d.mirrorAcross Plane3d.xy entity

            else
                entity

        e1 =
            if Angle.inDegrees spec.angle > 0.01 then
                Scene3d.rotateAround spec.axis spec.angle e0

            else
                e0
    in
    Scene3d.translateBy spec.shift e1


convertMesh mesh material transform highlight =
    let
        entity =
            case mesh of
                Lines m ->
                    Scene3d.mesh (Material.color Color.black) m

                Triangles m ->
                    Scene3d.mesh (Material.matte Color.green) m
    in
    applyTransform transform entity


view : List (Html.Attribute msg) -> Model a b -> Options -> Html msg
view attr model options =
    let
        convert { mesh, wireframe, material, transform, idxMesh, idxInstance } =
            let
                highlight =
                    Set.member ( idxMesh, idxInstance ) model.selected

                baseMesh =
                    convertMesh mesh material transform highlight
                        |> Just

                maybeWires =
                    if options.drawWires then
                        convertMesh wireframe material transform highlight
                            |> Just

                    else
                        Nothing
            in
            [ baseMesh, maybeWires ] |> List.filterMap identity

        entities =
            List.concatMap convert model.scene
    in
    Scene3d.sunny
        { entities = entities
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
