module Mesh exposing (Mesh(..), mesh, wireframe)


type Mesh vertex
    = Lines (List ( vertex, vertex ))
    | Triangles (List ( vertex, vertex, vertex ))


type alias FaceSpec =
    List Int


pullVertex : List vertex -> Int -> Maybe vertex
pullVertex vertices i =
    vertices |> List.drop i |> List.head


corners : List vertex -> FaceSpec -> List vertex
corners vertices face =
    List.filterMap (pullVertex vertices) face


triangles : List vertex -> List ( vertex, vertex, vertex )
triangles corners =
    case List.head corners of
        Nothing ->
            []

        Just u ->
            List.map2 (,) (List.drop 1 corners) (List.drop 2 corners)
                |> List.map (\( v, w ) -> ( u, v, w ))


edges : List vertex -> List ( vertex, vertex )
edges corners =
    List.map2 (,) corners ((List.drop 1 corners) ++ (List.take 1 corners))


mesh : List vertex -> List FaceSpec -> Mesh vertex
mesh vertices faces =
    List.concatMap (triangles << corners vertices) faces
        |> Triangles


wireframe : List vertex -> List FaceSpec -> Mesh vertex
wireframe vertices faces =
    List.concatMap (edges << corners vertices) faces
        |> Lines
