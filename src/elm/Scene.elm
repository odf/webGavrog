module Scene exposing (RawSceneSpec, Scene, boundingBox, makeScene)

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
    , materialIndex : Int
    , transform : RawTransform
    }


type alias RawSceneSpec =
    { meshes : List RawMeshSpec
    , materials : List RawMaterial
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


defaultMaterial : Renderer.Material
defaultMaterial =
    { ambientColor = vec3 0 0 0
    , diffuseColor = vec3 0 0 0
    , specularColor = vec3 0 0 0
    , ka = 0
    , kd = 0
    , ks = 0
    , shininess = 0
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


makeInstance : List Renderer.Material -> RawInstanceSpec -> Instance
makeInstance materials spec =
    { material =
        List.drop spec.materialIndex materials
            |> List.head
            |> Maybe.withDefault defaultMaterial
    , transform = makeTransform spec.transform
    }


makeMeshWithInstances :
    List RawInstanceSpec
    -> List Renderer.Material
    -> Int
    -> Mesh Renderer.Vertex
    -> MeshWithInstances
makeMeshWithInstances instances materials index mesh =
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.meshIndex == index)
            |> List.map (makeInstance materials)
    }


makeScene : RawSceneSpec -> Scene
makeScene spec =
    let
        materials =
            List.map makeMaterial spec.materials
    in
    List.map makeMesh spec.meshes
        |> List.indexedMap (makeMeshWithInstances spec.instances materials)


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


boundingBox : RawSceneSpec -> Box
boundingBox { meshes, instances } =
    let
        positions m =
            List.map (\v -> makeVec3 v.pos) m.vertices

        withTransforms index posList =
            instances
                |> List.filter (\inst -> inst.meshIndex == index)
                |> List.map (.transform >> makeTransform)
                |> List.map (\t -> ( posList, t ))

        allWithTransforms =
            meshes
                |> List.map positions
                |> List.indexedMap withTransforms
                |> List.concat
    in
    List.foldl
        (\( verts, mat ) -> boxWithMappedVertices verts mat)
        Nothing
        allWithTransforms
        |> Maybe.withDefault (Box (vec3 0 0 0) (vec3 0 0 0))
