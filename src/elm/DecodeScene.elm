module DecodeScene exposing
    ( Instance
    , MeshType(..)
    , Vertex
    , decodeInstance
    , decodeMesh
    )

import Json.Decode as Decode
import Length
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (Vec3, vec3)
import Mesh
import Point3d exposing (Point3d)
import Quantity
import TriangularMesh exposing (TriangularMesh)
import Vector3d exposing (Vector3d)


type alias Vertex coords =
    { position : Point3d Length.Meters coords
    , normal : Vector3d Quantity.Unitless coords
    }


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


decodeVec3 : Decode.Decoder Vec3
decodeVec3 =
    Decode.map3 vec3
        (Decode.index 0 Decode.float)
        (Decode.index 1 Decode.float)
        (Decode.index 2 Decode.float)


decodePoint : Decode.Decoder (Point3d Length.Meters coord)
decodePoint =
    Decode.map3 Point3d.meters
        (Decode.index 0 Decode.float)
        (Decode.index 1 Decode.float)
        (Decode.index 2 Decode.float)


decodeNormal : Decode.Decoder (Vector3d Quantity.Unitless coord)
decodeNormal =
    Decode.map3 Vector3d.unitless
        (Decode.index 0 Decode.float)
        (Decode.index 1 Decode.float)
        (Decode.index 2 Decode.float)


decodeVertex : Decode.Decoder (Vertex coords)
decodeVertex =
    Decode.map2 (\pos normal -> { position = pos, normal = normal })
        (Decode.field "pos" decodePoint)
        (Decode.field "normal" decodeNormal)


decodeMesh : Decode.Decoder (TriangularMesh (Vertex coords))
decodeMesh =
    Decode.map2 Mesh.fromOrientedFaces
        (Decode.field "vertices" (Decode.array decodeVertex))
        (Decode.field "faces" (Decode.list (Decode.list Decode.int)))
        |> Decode.map (Result.map Mesh.toTriangularMesh)
        |> Decode.andThen
            (\result ->
                case result of
                    Ok val ->
                        Decode.succeed val

                    Err msg ->
                        Decode.fail msg
            )


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
