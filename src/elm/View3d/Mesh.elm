module View3d.Mesh exposing
    ( Mesh(..)
    , mappedRayMeshIntersection
    , resolvedSurface
    , surface
    , wireframe
    )

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3)


type Mesh vertex
    = Lines (List ( vertex, vertex ))
    | Triangles (List ( vertex, vertex, vertex ))
    | IndexedTriangles (List vertex) (List ( Int, Int, Int ))


type alias FaceSpec =
    List Int


pullVertex : List vertex -> Int -> Maybe vertex
pullVertex vertices i =
    vertices |> List.drop i |> List.head


pullCorners : List vertex -> FaceSpec -> List vertex
pullCorners vertices face =
    List.filterMap (pullVertex vertices) face


makeTriangles : List vertex -> List ( vertex, vertex, vertex )
makeTriangles corners =
    case List.head corners of
        Nothing ->
            []

        Just u ->
            List.map2
                (\v w -> ( u, v, w ))
                (List.drop 1 corners)
                (List.drop 2 corners)


makeEdges : List vertex -> List ( vertex, vertex )
makeEdges corners =
    (List.drop 1 corners ++ List.take 1 corners)
        |> List.map2 Tuple.pair corners


surface : List vertex -> List FaceSpec -> Mesh vertex
surface vertices faces =
    List.concatMap makeTriangles faces
        |> IndexedTriangles vertices


resolvedSurface : List vertex -> List FaceSpec -> Mesh vertex
resolvedSurface vertices faces =
    List.concatMap (makeTriangles << pullCorners vertices) faces
        |> Triangles


wireframe : List vertex -> List FaceSpec -> Mesh vertex
wireframe vertices faces =
    List.concatMap (makeEdges << pullCorners vertices) faces
        |> Lines



-- Möller-Trumbore algorithm for ray-triangle intersection:


rayTriangleIntersection :
    Vec3
    -> Vec3
    -> ( Vec3, Vec3, Vec3 )
    -> Maybe ( Float, Float, Float )
rayTriangleIntersection orig dir ( vert0, vert1, vert2 ) =
    let
        edge1 =
            Vec3.sub vert1 vert0

        edge2 =
            Vec3.sub vert2 vert0

        pvec =
            Vec3.cross dir edge2

        det =
            Vec3.dot edge1 pvec
    in
    if abs det < 1.0e-6 then
        Nothing

    else
        let
            invDet =
                1 / det

            tvec =
                Vec3.sub orig vert0

            u =
                Vec3.dot tvec pvec * invDet
        in
        if u < 0 || u > 1 then
            Nothing

        else
            let
                qvec =
                    Vec3.cross tvec edge1

                v =
                    Vec3.dot dir qvec * invDet
            in
            if v < 0 || u + v > 1 then
                Nothing

            else
                let
                    t =
                        Vec3.dot edge2 qvec * invDet
                in
                Just ( t, u, v )


rayMeshIntersection : Vec3 -> Vec3 -> Mesh Vec3 -> Maybe Float
rayMeshIntersection orig dir mesh =
    let
        intersect triangles =
            triangles
                |> List.filterMap (rayTriangleIntersection orig dir)
                |> List.map (\( t, u, v ) -> t)
                |> List.minimum
    in
    case mesh of
        Lines _ ->
            Nothing

        Triangles triangles ->
            intersect triangles

        IndexedTriangles vertices triplets ->
            triplets
                |> List.map (\( i, j, k ) -> [ i, j, k ])
                |> List.concatMap (makeTriangles << pullCorners vertices)
                |> intersect


mappedRayMeshIntersection : Vec3 -> Vec3 -> Mat4 -> Mesh Vec3 -> Maybe Float
mappedRayMeshIntersection orig dir mat mesh =
    let
        target =
            Vec3.add orig dir

        mappedOrig =
            Mat4.transform mat orig

        mappedTarget =
            Mat4.transform mat target

        scaleFactor =
            Vec3.length (Vec3.sub mappedTarget mappedOrig)

        mappedDir =
            Vec3.normalize (Vec3.sub mappedTarget mappedOrig)
    in
    rayMeshIntersection mappedOrig mappedDir mesh
        |> Maybe.map ((/) scaleFactor)
