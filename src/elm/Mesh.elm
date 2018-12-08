module Mesh exposing (Mesh(..), surface, wireframe)


type Mesh vertex
    = Lines (List ( vertex, vertex ))
    | Triangles (List ( vertex, vertex, vertex ))


type alias FaceSpec =
    List Int


pullVertex : List vertex -> Int -> Maybe vertex
pullVertex vertices i =
    vertices |> List.drop i |> List.head


pullCorners : List vertex -> FaceSpec -> List vertex
pullCorners vertices face =
    List.filterMap (pullVertex vertices) face


triangles : List vertex -> List ( vertex, vertex, vertex )
triangles corners =
    case List.head corners of
        Nothing ->
            []

        Just u ->
            List.map2 Tuple.pair (List.drop 1 corners) (List.drop 2 corners)
                |> List.map (\( v, w ) -> ( u, v, w ))


edges : List vertex -> List ( vertex, vertex )
edges corners =
    (List.drop 1 corners ++ List.take 1 corners)
        |> List.map2 Tuple.pair corners


surface : List vertex -> List FaceSpec -> Mesh vertex
surface vertices faces =
    List.concatMap (triangles << pullCorners vertices) faces
        |> Triangles


wireframe : List vertex -> List FaceSpec -> Mesh vertex
wireframe vertices faces =
    List.concatMap (edges << pullCorners vertices) faces
        |> Lines
