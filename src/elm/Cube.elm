module Cube exposing (cube)

import Color exposing (Color)
import Math.Vector3 exposing (vec3, Vec3)
import WebGL
import Renderer exposing (Vertex)


cube : WebGL.Mesh Vertex
cube =
    let
        left =
            vec3 -1 0 0

        right =
            vec3 1 0 0

        front =
            vec3 0 1 0

        back =
            vec3 0 -1 0

        top =
            vec3 0 0 1

        bottom =
            vec3 0 0 -1

        rft =
            vec3 1 1 1

        lft =
            vec3 -1 1 1

        lbt =
            vec3 -1 -1 1

        rbt =
            vec3 1 -1 1

        rbb =
            vec3 1 -1 -1

        rfb =
            vec3 1 1 -1

        lfb =
            vec3 -1 1 -1

        lbb =
            vec3 -1 -1 -1
    in
        [ face right Color.green rft rfb rbb rbt
        , face front Color.blue rft rfb lfb lft
        , face top Color.yellow rft lft lbt rbt
        , face bottom Color.red rfb lfb lbb rbb
        , face left Color.purple lft lfb lbb lbt
        , face back Color.orange rbt rbb lbb lbt
        ]
            |> List.concat
            |> WebGL.triangles


face : Vec3 -> Color -> Vec3 -> Vec3 -> Vec3 -> Vec3 -> List ( Vertex, Vertex, Vertex )
face normal rawColor a b c d =
    let
        color =
            let
                c =
                    Color.toRgb rawColor
            in
                vec3
                    (toFloat c.red / 255)
                    (toFloat c.green / 255)
                    (toFloat c.blue / 255)

        vertex position =
            Vertex color position normal
    in
        [ ( vertex a, vertex b, vertex c )
        , ( vertex c, vertex d, vertex a )
        ]
