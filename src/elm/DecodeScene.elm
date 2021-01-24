module DecodeScene exposing (Instance, MeshType(..), Scene, decodeScene)

import Json.Decode as Decode
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (Vec3, vec3)
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.RendererWebGL exposing (VertexSpec)


type alias Instance =
    { meshType : MeshType
    , classIndex : Maybe Int
    , latticeIndex : Maybe Int
    , meshIndex : Int
    , transform : Mat4
    }


type MeshType
    = TileFace
    | TileEdges
    | NetVertex
    | NetEdge
    | CellEdge
    | Unknown


type alias MeshWithInstances =
    { mesh : Mesh VertexSpec
    , instances : List Instance
    }


type alias Scene =
    List MeshWithInstances


decodeVec3 : Decode.Decoder Vec3
decodeVec3 =
    Decode.map3 vec3
        (Decode.index 0 Decode.float)
        (Decode.index 1 Decode.float)
        (Decode.index 2 Decode.float)


decodeVertex : Decode.Decoder VertexSpec
decodeVertex =
    Decode.map2 (\pos normal -> { pos = pos, normal = normal })
        (Decode.field "pos" decodeVec3)
        (Decode.field "normal" decodeVec3)


decodeMesh : Decode.Decoder (Mesh VertexSpec)
decodeMesh =
    Decode.map2 Mesh.surface
        (Decode.field "vertices" (Decode.list decodeVertex))
        (Decode.field "faces" (Decode.list (Decode.list Decode.int)))


decodeBasis : Decode.Decoder ( Vec3, Vec3, Vec3 )
decodeBasis =
    Decode.map3 (\u v w -> ( u, v, w ))
        (Decode.index 0 decodeVec3)
        (Decode.index 1 decodeVec3)
        (Decode.index 2 decodeVec3)


decodeTransform : Decode.Decoder Mat4
decodeTransform =
    Decode.map2
        (\( u, v, w ) shift ->
            Mat4.mul (Mat4.makeTranslate shift) (Mat4.makeBasis u v w)
        )
        (Decode.field "basis" decodeBasis)
        (Decode.field "shift" decodeVec3)


decodeMeshType : String -> MeshType
decodeMeshType s =
    case s of
        "tileFace" ->
            TileFace

        "tileEdges" ->
            TileEdges

        "netVertex" ->
            NetVertex

        "netEdge" ->
            NetEdge

        "cellEdge" ->
            CellEdge

        _ ->
            Unknown


decodeInstance : Decode.Decoder Instance
decodeInstance =
    Decode.map6
        (\meshType classIndex latticeIndex meshIndex transform shift ->
            { meshType = decodeMeshType meshType
            , classIndex = classIndex
            , latticeIndex = latticeIndex
            , meshIndex = meshIndex
            , transform = Mat4.mul (Mat4.makeTranslate shift) transform
            }
        )
        (Decode.field "meshType" Decode.string)
        (Decode.maybe <| Decode.field "classIndex" Decode.int)
        (Decode.maybe <| Decode.field "latticeIndex" Decode.int)
        (Decode.field "meshIndex" Decode.int)
        (Decode.field "transform" decodeTransform)
        (Decode.field "extraShift" decodeVec3)


meshWithInstances : List Instance -> Int -> Mesh VertexSpec -> MeshWithInstances
meshWithInstances instances index mesh =
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.meshIndex == index)
    }


decodeScene : Decode.Decoder Scene
decodeScene =
    Decode.map2
        (\meshes instances ->
            List.indexedMap (meshWithInstances instances) meshes
        )
        (Decode.field "meshes" (Decode.list decodeMesh))
        (Decode.field "instances" (Decode.list decodeInstance))
