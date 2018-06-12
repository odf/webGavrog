module Mesh exposing (VertexSpec, FaceSpec, mesh, wireframe)

import Color exposing (Color)
import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer exposing (Vertex)


type alias VertexSpec =
    { pos : Vec3
    , normal : Vec3
    }


type alias FaceSpec =
    { vertices : List Int
    , color : Color
    }


colorVec { red, green, blue } =
    vec3 (toFloat red / 255) (toFloat green / 255) (toFloat blue / 255)


buildVertex : Color -> VertexSpec -> Vertex
buildVertex color v =
    { pos = v.pos, normal = v.normal, color = colorVec (Color.toRgb color) }


pullVertex : List VertexSpec -> Color -> Int -> Maybe Vertex
pullVertex vertices color i =
    vertices |> List.drop i |> List.head |> Maybe.map (buildVertex color)


corners : List VertexSpec -> FaceSpec -> List Vertex
corners vertices face =
    List.filterMap (pullVertex vertices face.color) face.vertices


triangles : List Vertex -> List ( Vertex, Vertex, Vertex )
triangles corners =
    case List.head corners of
        Nothing ->
            []

        Just u ->
            List.map2 (,) (List.drop 1 corners) (List.drop 2 corners)
                |> List.map (\( v, w ) -> ( u, v, w ))


edges : List Vertex -> List ( Vertex, Vertex )
edges corners =
    List.map2 (,) corners ((List.drop 1 corners) ++ (List.take 1 corners))


mesh : List VertexSpec -> List FaceSpec -> WebGL.Mesh Vertex
mesh vertices faces =
    List.concatMap (triangles << corners vertices) faces
        |> WebGL.triangles


wireframe : List VertexSpec -> List FaceSpec -> WebGL.Mesh Vertex
wireframe vertices faces =
    List.concatMap (edges << corners vertices) faces
        |> WebGL.lines
