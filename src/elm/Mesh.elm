module Mesh exposing (Mesh(..), mesh, wireframe)

import Math.Vector3 exposing (vec3, Vec3)
import Renderer exposing (Vertex)


type Mesh
    = Lines (List ( Vertex, Vertex ))
    | Triangles (List ( Vertex, Vertex, Vertex ))


type alias FaceSpec =
    List Int


pullVertex : List Vertex -> Int -> Maybe Vertex
pullVertex vertices i =
    vertices |> List.drop i |> List.head


corners : List Vertex -> FaceSpec -> List Vertex
corners vertices face =
    List.filterMap (pullVertex vertices) face


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


mesh : List Vertex -> List FaceSpec -> Mesh
mesh vertices faces =
    List.concatMap (triangles << corners vertices) faces
        |> Triangles


wireframe : List Vertex -> List FaceSpec -> Mesh
wireframe vertices faces =
    List.concatMap (edges << corners vertices) faces
        |> Lines
