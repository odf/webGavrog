module View3d.RendererScene3d exposing
    ( Mesh
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
import Maybe
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
import View3d.RendererCommon exposing (..)
import Viewpoint3d
import WebGL exposing (entity)



-- The mesh type and mesh generating functions are placeholders for now


type WorldCoordinates
    = WorldCoordinates


type Mesh
    = Lines (Scene3d.Mesh.Plain WorldCoordinates)
    | Triangles (Scene3d.Mesh.Uniform WorldCoordinates)


asPointInInches : Vec3 -> Point3d Meters coords
asPointInInches p =
    Point3d.inches (Vec3.getX p) (Vec3.getY p) (Vec3.getZ p)


asUnitlessDirection : Vec3 -> Vector3d Unitless coords
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


type alias Model a b =
    { a
        | size : { width : Float, height : Float }
        , scene : Scene b Mesh
        , selected : Set ( Int, Int )
        , center : Vec3
        , radius : Float
        , cameraState : Camera.State
    }


convertCamera : Camera.State -> Camera3d.Camera3d Length.Meters coords
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


orthonormalized : Mat4 -> Mat4
orthonormalized mat =
    let
        project a b =
            Vec3.scale (Vec3.dot a b) b

        u =
            vec3 1 0 0 |> Mat4.transform mat |> Vec3.normalize

        v0 =
            vec3 0 1 0 |> Mat4.transform mat

        v =
            project v0 u
                |> Vec3.sub v0
                |> Vec3.normalize

        w0 =
            vec3 0 0 1 |> Mat4.transform mat

        w =
            Vec3.add (project w0 u) (project w0 v)
                |> Vec3.sub w0
                |> Vec3.normalize
    in
    Mat4.makeBasis u v w


determinant3d : Mat4 -> Float
determinant3d mat =
    Vec3.dot
        (Mat4.transform mat <| vec3 1 0 0)
        (Vec3.cross
            (Mat4.transform mat <| vec3 0 1 0)
            (Mat4.transform mat <| vec3 0 0 1)
        )


longestTwo : Vec3 -> Vec3 -> Vec3 -> ( Vec3, Vec3 )
longestTwo u v w =
    let
        ( a, b ) =
            if Vec3.length u >= Vec3.length v then
                if Vec3.length v >= Vec3.length w then
                    ( u, v )

                else
                    ( u, w )

            else if Vec3.length u >= Vec3.length w then
                ( u, v )

            else
                ( v, w )
    in
    if Vec3.length a >= Vec3.length b then
        ( a, b )

    else
        ( b, a )


sign : number -> number
sign n =
    if n < 0 then
        -1

    else
        1


analyzeRotation :
    Mat4
    -> { axis : Axis3d.Axis3d Meters coords, angle : Angle.Angle }
analyzeRotation mat =
    let
        moved vec =
            Mat4.transform mat vec |> Vec3.sub vec

        ( v, w ) =
            longestTwo (moved Vec3.i) (moved Vec3.j) (moved Vec3.k)
    in
    if Vec3.length v < 1.0e-3 then
        { axis = Axis3d.x, angle = Angle.degrees 0 }

    else
        let
            n =
                Vec3.cross v w |> Vec3.normalize

            axis =
                n
                    |> asPointInInches
                    |> Axis3d.throughPoints Point3d.origin
                    |> Maybe.withDefault Axis3d.x

            a =
                Vec3.normalize v

            b =
                Mat4.transform mat a |> Vec3.normalize

            c =
                Vec3.cross a b

            angle =
                if Vec3.length c < 1.0e-3 then
                    pi

                else
                    sign (Vec3.dot c n) * acos (Vec3.dot a b)
        in
        { axis = axis, angle = Angle.radians angle }


applySimilarityMatrix : Mat4 -> Scene3d.Entity coords -> Scene3d.Entity coords
applySimilarityMatrix matrix entity =
    let
        shift =
            vec3 0 0 0
                |> Mat4.transform matrix

        shiftVector =
            shift
                |> asPointInInches
                |> Vector3d.from Point3d.origin

        mat1 =
            Mat4.mul (Mat4.makeTranslate (Vec3.negate shift)) matrix

        det =
            determinant3d mat1

        scale =
            sign det * (abs det ^ (1 / 3))

        { axis, angle } =
            Mat4.scale3 (1 / scale) (1 / scale) (1 / scale) mat1
                |> orthonormalized
                |> analyzeRotation
    in
    entity
        |> Scene3d.scaleAbout Point3d.origin scale
        |> Scene3d.rotateAround axis angle
        |> Scene3d.translateBy shiftVector


convertColor : Vec3 -> Color.Color
convertColor vec =
    let
        c =
            Vec3.toRecord vec
    in
    Color.rgb c.x c.y c.z


convertMesh :
    Mesh
    -> MaterialSpec
    -> Mat4
    -> Bool
    -> Scene3d.Entity WorldCoordinates
convertMesh mesh { diffuseColor } transform highlight =
    let
        entity =
            case mesh of
                Lines m ->
                    Scene3d.mesh (Material.color Color.black) m

                Triangles m ->
                    let
                        material =
                            if highlight then
                                Material.matte Color.red

                            else
                                Material.pbr
                                    { baseColor = convertColor diffuseColor
                                    , roughness = 0.5
                                    , metallic = 0.5
                                    }
                    in
                    Scene3d.mesh material m
    in
    applySimilarityMatrix transform entity


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
        , background =
            convertColor options.backgroundColor
                |> Scene3d.backgroundColor
        , clipDepth = Length.centimeters 1
        , shadows = False
        , dimensions =
            ( Pixels.int (floor model.size.width)
            , Pixels.int (floor model.size.height)
            )
        }
