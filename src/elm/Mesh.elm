module Mesh exposing (VertexSpec, FaceSpec, mesh, wireframe)

import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer exposing (Vertex)


type alias VertexSpec =
    { pos : Vec3
    , normal : Vec3
    }


type alias FaceSpec =
    { vertices : List Int
    , color : Vec3
    }


makeVertex : List VertexSpec -> Vec3 -> Int -> Vertex
makeVertex vertices color i =
    case (vertices |> List.drop i |> List.head) of
        Nothing ->
            { pos = vec3 0 0 0, normal = vec3 1 1 1, color = color }

        Just v ->
            { pos = v.pos, normal = v.normal, color = color }


triangles : List VertexSpec -> FaceSpec -> List ( Vertex, Vertex, Vertex )
triangles vertices face =
    let
        corners =
            List.map (makeVertex vertices face.color) face.vertices
    in
        case List.head corners of
            Nothing ->
                []

            Just u ->
                List.map2 (,) (List.drop 1 corners) (List.drop 2 corners)
                    |> List.map (\( v, w ) -> ( u, v, w ))


edges : List VertexSpec -> FaceSpec -> List ( Vertex, Vertex )
edges vertices face =
    let
        corners =
            List.map (makeVertex vertices face.color) face.vertices
    in
        List.map2 (,) corners ((List.drop 1 corners) ++ (List.take 1 corners))


mesh : List VertexSpec -> List FaceSpec -> WebGL.Mesh Vertex
mesh vertices faces =
    List.map (triangles vertices) faces
        |> List.concat
        |> WebGL.triangles


wireframe : List VertexSpec -> List FaceSpec -> WebGL.Mesh Vertex
wireframe vertices faces =
    List.map (edges vertices) faces
        |> List.concat
        |> WebGL.lines
