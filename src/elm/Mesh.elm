module Mesh exposing (VertexSpec, FaceSpec, mesh, wireframe)

import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer


type alias Coords =
    ( Float, Float, Float )


type alias Color =
    ( Float, Float, Float )


type alias VertexSpec =
    { pos : Coords
    , normal : Coords
    }


type alias FaceSpec =
    { vertices : List Int
    , color : Coords
    }


type alias Triangle =
    ( Renderer.Vertex, Renderer.Vertex, Renderer.Vertex )


type alias Edge =
    ( Renderer.Vertex, Renderer.Vertex )


toVec3 : Coords -> Vec3
toVec3 ( a, b, c ) =
    vec3 a b c


toVertex : Coords -> Coords -> Color -> Renderer.Vertex
toVertex pos normal color =
    { pos = toVec3 pos
    , normal = toVec3 normal
    , color = toVec3 color
    }


makeVertex : List VertexSpec -> Color -> Int -> Renderer.Vertex
makeVertex vertices color i =
    case (vertices |> List.drop i |> List.head) of
        Nothing ->
            toVertex ( 0, 0, 0 ) ( 1, 1, 1 ) color

        Just v ->
            toVertex v.pos v.normal color


makeVertices : List VertexSpec -> List Int -> Color -> List Renderer.Vertex
makeVertices vertices indices color =
    List.map (makeVertex vertices color) indices


triangles : List VertexSpec -> FaceSpec -> List Triangle
triangles vertices face =
    let
        corners =
            makeVertices vertices face.vertices face.color
    in
        case List.head corners of
            Nothing ->
                []

            Just u ->
                List.map2 (,) (List.drop 1 corners) (List.drop 2 corners)
                    |> List.map (\( v, w ) -> ( u, v, w ))


edges : List VertexSpec -> FaceSpec -> List Edge
edges vertices face =
    let
        corners =
            makeVertices vertices face.vertices face.color
    in
        List.map2 (,) corners ((List.drop 1 corners) ++ (List.take 1 corners))


mesh : List VertexSpec -> List FaceSpec -> WebGL.Mesh Renderer.Vertex
mesh vertices faces =
    List.map (triangles vertices) faces
        |> List.concat
        |> WebGL.triangles


wireframe : List VertexSpec -> List FaceSpec -> WebGL.Mesh Renderer.Vertex
wireframe vertices faces =
    List.map (edges vertices) faces
        |> List.concat
        |> WebGL.lines
