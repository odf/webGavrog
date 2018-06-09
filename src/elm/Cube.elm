module Cube exposing (cube)

import Color exposing (Color)
import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer


type alias Vertex =
    { pos : ( Float, Float, Float )
    , normal : ( Float, Float, Float )
    }


type alias Face =
    { vertices : List Int
    , color : ( Float, Float, Float )
    }


type alias Triangle =
    ( Renderer.Vertex, Renderer.Vertex, Renderer.Vertex )


toVec3 : ( Float, Float, Float ) -> Vec3
toVec3 ( a, b, c ) =
    vec3 a b c


makeVertex : List Vertex -> Vec3 -> Int -> Renderer.Vertex
makeVertex vertices color i =
    case (vertices |> List.drop i |> List.head) of
        Nothing ->
            { pos = vec3 0 0 0
            , normal = vec3 1 1 1
            , color = color
            }

        Just v ->
            { pos = toVec3 v.pos
            , normal = toVec3 v.normal
            , color = color
            }


triangulate : List Vertex -> Face -> List Triangle
triangulate vertices face =
    let
        color =
            toVec3 face.color

        corners =
            List.map (makeVertex vertices color) face.vertices
    in
        case List.head corners of
            Nothing ->
                []

            Just u ->
                List.map2 (,) (List.drop 1 corners) (List.drop 2 corners)
                    |> List.map (\( v, w ) -> ( u, v, w ))


mesh : List Vertex -> List Face -> WebGL.Mesh Renderer.Vertex
mesh vertices faces =
    List.map (triangulate vertices) faces
        |> List.concat
        |> WebGL.triangles


vertices : List Vertex
vertices =
    [ { pos = ( -1, -1, -1 ), normal = ( 0, 0, -1 ) }
    , { pos = ( 1, -1, -1 ), normal = ( 0, 0, -1 ) }
    , { pos = ( 1, 1, -1 ), normal = ( 0, 0, -1 ) }
    , { pos = ( -1, 1, -1 ), normal = ( 0, 0, -1 ) }
    , { pos = ( -1, -1, 1 ), normal = ( 0, 0, 1 ) }
    , { pos = ( 1, -1, 1 ), normal = ( 0, 0, 1 ) }
    , { pos = ( 1, 1, 1 ), normal = ( 0, 0, 1 ) }
    , { pos = ( -1, 1, 1 ), normal = ( 0, 0, 1 ) }
    , { pos = ( -1, -1, -1 ), normal = ( 0, -1, 0 ) }
    , { pos = ( -1, -1, 1 ), normal = ( 0, -1, 0 ) }
    , { pos = ( 1, -1, 1 ), normal = ( 0, -1, 0 ) }
    , { pos = ( 1, -1, -1 ), normal = ( 0, -1, 0 ) }
    , { pos = ( -1, 1, -1 ), normal = ( 0, 1, 0 ) }
    , { pos = ( -1, 1, 1 ), normal = ( 0, 1, 0 ) }
    , { pos = ( 1, 1, 1 ), normal = ( 0, 1, 0 ) }
    , { pos = ( 1, 1, -1 ), normal = ( 0, 1, 0 ) }
    , { pos = ( -1, -1, -1 ), normal = ( -1, 0, 0 ) }
    , { pos = ( -1, 1, -1 ), normal = ( -1, 0, 0 ) }
    , { pos = ( -1, 1, 1 ), normal = ( -1, 0, 0 ) }
    , { pos = ( -1, -1, 1 ), normal = ( -1, 0, 0 ) }
    , { pos = ( 1, -1, -1 ), normal = ( 1, 0, 0 ) }
    , { pos = ( 1, 1, -1 ), normal = ( 1, 0, 0 ) }
    , { pos = ( 1, 1, 1 ), normal = ( 1, 0, 0 ) }
    , { pos = ( 1, -1, 1 ), normal = ( 1, 0, 0 ) }
    ]


faces : List Face
faces =
    [ { vertices = [ 0, 1, 2, 3, 0 ], color = ( 1, 0, 0 ) }
    , { vertices = [ 4, 7, 6, 5, 4 ], color = ( 0, 1, 1 ) }
    , { vertices = [ 8, 9, 10, 11, 8 ], color = ( 0, 1, 0 ) }
    , { vertices = [ 12, 15, 14, 13, 12 ], color = ( 1, 0, 1 ) }
    , { vertices = [ 16, 17, 18, 19, 16 ], color = ( 0, 0, 1 ) }
    , { vertices = [ 20, 23, 22, 21, 20 ], color = ( 1, 1, 0 ) }
    ]


cube : WebGL.Mesh Renderer.Vertex
cube =
    mesh vertices faces
