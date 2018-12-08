module Scene exposing (RawSceneSpec, Scene, boundingBoxForScene, makeScene)

import Color exposing (Color)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Mesh exposing (Mesh)
import Renderer


type alias RawVec3 =
    ( Float, Float, Float )


type alias RawColor =
    { hue : Float
    , saturation : Float
    , lightness : Float
    }


type alias RawVertexSpec =
    { pos : RawVec3
    , normal : RawVec3
    }


type alias RawMeshSpec =
    { vertices : List RawVertexSpec
    , faces : List (List Int)
    , isWireframe : Bool
    }


type alias RawMaterial =
    { ambientColor : RawColor
    , diffuseColor : RawColor
    , specularColor : RawColor
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias RawTransform =
    { basis : ( RawVec3, RawVec3, RawVec3 )
    , shift : RawVec3
    }


type alias RawInstanceSpec =
    { meshIndex : Int
    , material : RawMaterial
    , transform : RawTransform
    }


type alias RawSceneSpec =
    { meshes : List RawMeshSpec
    , instances : List RawInstanceSpec
    }


type alias Instance =
    { material : Renderer.Material
    , transform : Mat4
    }


type alias MeshWithInstances =
    { mesh : Mesh Renderer.Vertex
    , instances : List Instance
    }


type alias Scene =
    List MeshWithInstances


type alias Box =
    { minima : Vec3
    , maxima : Vec3
    }


makeVec3 : RawVec3 -> Vec3
makeVec3 ( a, b, c ) =
    vec3 a b c


makeVec3Color : RawColor -> Vec3
makeVec3Color { hue, saturation, lightness } =
    let
        { red, green, blue, alpha } =
            Color.toRgba <| Color.hsl hue saturation lightness
    in
    vec3 red green blue


makeVertex : RawVertexSpec -> Renderer.Vertex
makeVertex v =
    { pos = makeVec3 v.pos
    , normal = makeVec3 v.normal
    }


makeMesh : RawMeshSpec -> Mesh Renderer.Vertex
makeMesh spec =
    if spec.isWireframe then
        Mesh.wireframe (List.map makeVertex spec.vertices) spec.faces

    else
        Mesh.surface (List.map makeVertex spec.vertices) spec.faces


makeMaterial : RawMaterial -> Renderer.Material
makeMaterial mat =
    { ambientColor = makeVec3Color mat.ambientColor
    , diffuseColor = makeVec3Color mat.diffuseColor
    , specularColor = makeVec3Color mat.specularColor
    , ka = mat.ka
    , kd = mat.kd
    , ks = mat.ks
    , shininess = mat.shininess
    }


makeTransform : RawTransform -> Mat4
makeTransform { basis, shift } =
    let
        ( u, v, w ) =
            basis
    in
    Mat4.mul
        (Mat4.makeTranslate <| makeVec3 shift)
        (Mat4.makeBasis (makeVec3 u) (makeVec3 v) (makeVec3 w))


makeInstance : RawInstanceSpec -> Instance
makeInstance spec =
    { material = makeMaterial spec.material
    , transform = makeTransform spec.transform
    }


makeMeshWithInstances :
    List RawInstanceSpec
    -> Int
    -> Mesh Renderer.Vertex
    -> MeshWithInstances
makeMeshWithInstances instances index mesh =
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.meshIndex == index)
            |> List.map makeInstance
    }


makeScene : RawSceneSpec -> Scene
makeScene spec =
    List.map makeMesh spec.meshes
        |> List.indexedMap (makeMeshWithInstances spec.instances)


minVec : Vec3 -> Vec3 -> Vec3
minVec v w =
    vec3
        (min (Vec3.getX v) (Vec3.getX w))
        (min (Vec3.getY v) (Vec3.getY w))
        (min (Vec3.getZ v) (Vec3.getZ w))


maxVec : Vec3 -> Vec3 -> Vec3
maxVec v w =
    vec3
        (max (Vec3.getX v) (Vec3.getX w))
        (max (Vec3.getY v) (Vec3.getY w))
        (max (Vec3.getZ v) (Vec3.getZ w))


boxWithVector : Vec3 -> Maybe Box -> Maybe Box
boxWithVector v box =
    case box of
        Nothing ->
            Just <| Box v v

        Just b ->
            Just <| Box (minVec v b.minima) (maxVec v b.maxima)


boxWithMappedVertices : List Vec3 -> Mat4 -> Maybe Box -> Maybe Box
boxWithMappedVertices verts mat box =
    List.foldl (\v b -> boxWithVector (Mat4.transform mat v) b) box verts


boxWithInstancedMesh :
    Mesh Renderer.Vertex
    -> Instance
    -> Maybe Box
    -> Maybe Box
boxWithInstancedMesh mesh instance box =
    let
        mat =
            instance.transform
    in
    case mesh of
        Mesh.Lines lines ->
            List.foldl
                (\( u, v ) b ->
                    boxWithMappedVertices [ u.pos, v.pos ] mat b
                )
                box
                lines

        Mesh.Triangles triangles ->
            List.foldl
                (\( u, v, w ) b ->
                    boxWithMappedVertices [ u.pos, v.pos, w.pos ] mat b
                )
                box
                triangles


boundingBoxForScene : Scene -> Box
boundingBoxForScene scene =
    List.foldl
        (\{ mesh, instances } box ->
            List.foldl
                (\inst b -> boxWithInstancedMesh mesh inst b)
                box
                instances
        )
        Nothing
        scene
        |> Maybe.withDefault (Box (vec3 0 0 0) (vec3 0 0 0))
