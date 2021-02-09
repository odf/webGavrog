module View3d.RendererScene3d exposing
    ( Mesh
    , convertMeshForRenderer
    , entities
    )

import Angle
import Array exposing (Array)
import Axis3d
import Camera3d
import Color
import Direction3d
import Illuminance
import Length exposing (Meters)
import LineSegment3d
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Maybe
import Point3d exposing (Point3d)
import Quantity exposing (Unitless)
import Scene3d
import Scene3d.Light as Light
import Scene3d.Material as Material
import Scene3d.Mesh
import Set
import Triangle3d
import TriangularMesh
import Vector3d exposing (Vector3d)
import View3d.Camera as Camera
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.RendererCommon exposing (..)
import Viewpoint3d
import WebGL



-- The mesh type and mesh generating functions are placeholders for now


type WorldCoordinates
    = WorldCoordinates


type alias Mesh =
    { wireframe : Scene3d.Mesh.Plain WorldCoordinates
    , surface : Scene3d.Mesh.Uniform WorldCoordinates
    , outline : Scene3d.Mesh.Uniform WorldCoordinates
    , shadow : Scene3d.Mesh.Shadow WorldCoordinates
    }


asPointInInches : Vec3 -> Point3d Meters coords
asPointInInches p =
    Point3d.inches (Vec3.getX p) (Vec3.getY p) (Vec3.getZ p)


asUnitlessDirection : Vec3 -> Vector3d Unitless coords
asUnitlessDirection p =
    Vector3d.unitless (Vec3.getX p) (Vec3.getY p) (Vec3.getZ p)


convertSurface : Mesh.Mesh Vertex -> Scene3d.Mesh.Uniform WorldCoordinates
convertSurface mesh =
    case mesh of
        Mesh.Lines _ ->
            Scene3d.Mesh.facets []

        Mesh.Triangles triangles ->
            triangles
                |> List.map
                    (\( p, q, r ) ->
                        Triangle3d.from
                            (asPointInInches p.position)
                            (asPointInInches q.position)
                            (asPointInInches r.position)
                    )
                |> Scene3d.Mesh.facets

        Mesh.IndexedTriangles vertices triangles ->
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
            TriangularMesh.indexed verts triangles
                |> Scene3d.Mesh.indexedFaces


convertWireframe : Mesh.Mesh Vertex -> Scene3d.Mesh.Plain WorldCoordinates
convertWireframe mesh =
    case mesh of
        Mesh.Lines lines ->
            lines
                |> List.map
                    (\( p, q ) ->
                        LineSegment3d.from
                            (asPointInInches p.position)
                            (asPointInInches q.position)
                    )
                |> Scene3d.Mesh.lineSegments

        Mesh.Triangles _ ->
            Scene3d.Mesh.lineSegments []

        Mesh.IndexedTriangles _ _ ->
            Scene3d.Mesh.lineSegments []


pushOut :
    Float
    -> { a | position : Vec3, normal : Vec3 }
    -> { a | position : Vec3, normal : Vec3 }
pushOut amount vertex =
    { vertex
        | position = Vec3.add vertex.position (Vec3.scale amount vertex.normal)
        , normal = vertex.normal
    }


convertMeshForRenderer : Mesh.Mesh Vertex -> Mesh
convertMeshForRenderer mesh =
    let
        surface =
            convertSurface mesh

        shadow =
            Scene3d.Mesh.shadow surface

        wireframe =
            mesh
                |> Mesh.wireframe
                |> Mesh.mapVertices (pushOut 0.0001)
                |> convertWireframe

        outline =
            mesh
                |> Mesh.mapVertices (pushOut 0.02)
                |> Mesh.invertMesh
                |> convertSurface
                |> Scene3d.Mesh.cullBackFaces
    in
    { surface = surface
    , shadow = shadow
    , wireframe = wireframe
    , outline = outline
    }


convertCamera :
    Camera.State
    -> Options
    -> Camera3d.Camera3d Length.Meters coords
convertCamera camState options =
    let
        focalPoint =
            Point3d.inches 0 0 -(Camera.cameraDistance camState)

        viewpoint =
            Viewpoint3d.lookAt
                { focalPoint = focalPoint
                , eyePoint = Point3d.origin
                , upDirection = Direction3d.positiveY
                }

        fovy =
            Camera.verticalFieldOfView camState |> Angle.degrees

        height =
            Camera.viewPortHeight camState |> Length.inches
    in
    if options.orthogonalView then
        Camera3d.orthographic
            { viewpoint = viewpoint, viewportHeight = height }

    else
        Camera3d.perspective
            { viewpoint = viewpoint, verticalFieldOfView = fovy }


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


entities : Array Mesh -> Model a -> Options -> List WebGL.Entity
entities meshes model options =
    let
        convert { material, transform, idxMesh, idxInstance } mesh =
            let
                highlight =
                    Set.member ( idxMesh, idxInstance ) model.selected

                mOut =
                    if highlight then
                        Material.matte Color.red

                    else
                        Material.pbr
                            { baseColor = convertColor material.diffuseColor
                            , roughness = 0.4
                            , metallic = 0.2
                            }

                surface =
                    if options.drawShadows then
                        Scene3d.meshWithShadow mOut mesh.surface mesh.shadow

                    else
                        Scene3d.mesh mOut mesh.surface

                maybeWires =
                    if options.drawWires then
                        Scene3d.mesh (Material.color Color.black) mesh.wireframe

                    else
                        Scene3d.nothing

                maybeOutlines =
                    if options.addOutlines then
                        let
                            color =
                                convertColor options.outlineColor
                        in
                        Scene3d.mesh (Material.color color) mesh.outline

                    else
                        Scene3d.nothing
            in
            [ surface, maybeWires, maybeOutlines ]
                |> Scene3d.group
                |> applySimilarityMatrix transform

        scene3dEntities =
            model.scene
                |> List.map
                    (\item ->
                        Array.get item.idxMesh meshes
                            |> Maybe.map (convert item)
                            |> Maybe.withDefault Scene3d.nothing
                    )
                |> Scene3d.group
                |> applySimilarityMatrix
                    (Camera.viewingMatrix model.cameraState)
                |> List.singleton

        sun =
            Light.directional (Light.castsShadows options.drawShadows)
                { direction = Direction3d.yz (Angle.degrees -120)
                , intensity = Illuminance.lux 80000
                , chromaticity = Light.sunlight
                }

        sky =
            Light.overhead
                { upDirection = Direction3d.z
                , chromaticity = Light.skylight
                , intensity = Illuminance.lux 30000
                }

        environment =
            Light.overhead
                { upDirection = Direction3d.reverse Direction3d.z
                , chromaticity = Light.daylight
                , intensity = Illuminance.lux 5000
                }

        lights =
            Scene3d.threeLights sun sky environment
    in
    Scene3d.toWebGLEntities
        { lights = lights
        , camera = convertCamera model.cameraState options
        , clipDepth = Length.centimeters 1
        , exposure = Scene3d.exposureValue 15
        , toneMapping = Scene3d.noToneMapping
        , whiteBalance = Light.daylight
        , aspectRatio = model.size.width / model.size.height
        , supersampling = 1
        , entities = scene3dEntities
        }
