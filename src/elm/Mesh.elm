module Mesh exposing (mesh, VertexSpec, FaceSpec)

import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer


type alias VertexSpec =
    { pos : ( Float, Float, Float )
    , normal : ( Float, Float, Float )
    }


type alias FaceSpec =
    { vertices : List Int
    , color : ( Float, Float, Float )
    }


type alias Triangle =
    ( Renderer.Vertex, Renderer.Vertex, Renderer.Vertex )


toVec3 : ( Float, Float, Float ) -> Vec3
toVec3 ( a, b, c ) =
    vec3 a b c


makeVertex : List VertexSpec -> Vec3 -> Int -> Renderer.Vertex
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


triangulate : List VertexSpec -> FaceSpec -> List Triangle
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


mesh : List VertexSpec -> List FaceSpec -> WebGL.Mesh Renderer.Vertex
mesh vertices faces =
    List.map (triangulate vertices) faces
        |> List.concat
        |> WebGL.triangles
