module View3d.Mesh exposing
    ( Mesh(..)
    , getVertices
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


getVertices : Mesh vertex -> List vertex
getVertices mesh =
    case mesh of
        Lines lines ->
            lines
                |> List.concatMap (\( u, v ) -> [ u, v ])

        Triangles triangles ->
            triangles
                |> List.concatMap (\( u, v, w ) -> [ u, v, w ])

        IndexedTriangles vertices _ ->
            vertices



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


rayIntersectsSphere : Vec3 -> Vec3 -> Vec3 -> Float -> Bool
rayIntersectsSphere orig dir center radius =
    let
        t =
            Vec3.sub center orig

        lambda =
            Vec3.dot t dir
    in
    Vec3.lengthSquared t - lambda ^ 2 <= radius ^ 2


rayMeshIntersection : Vec3 -> Vec3 -> Mesh Vec3 -> Vec3 -> Float -> Maybe Float
rayMeshIntersection orig dir mesh center radius =
    if rayIntersectsSphere orig dir center radius then
        let
            step triangle bestSoFar =
                case rayTriangleIntersection orig dir triangle of
                    Nothing ->
                        bestSoFar

                    Just ( tNew, _, _ ) ->
                        case bestSoFar of
                            Nothing ->
                                Just tNew

                            Just tOld ->
                                if tNew < tOld && tNew > 0 then
                                    Just tNew

                                else
                                    bestSoFar

            intersect =
                List.foldl step Nothing
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

    else
        Nothing


mappedRayMeshIntersection :
    Vec3
    -> Vec3
    -> Mat4
    -> Mesh Vec3
    -> Vec3
    -> Float
    -> Maybe Float
mappedRayMeshIntersection orig dir mat mesh center radius =
    let
        target =
            Vec3.add orig dir

        mappedOrig =
            Mat4.transform mat orig

        mappedTarget =
            Mat4.transform mat target

        factor =
            1 / Vec3.length (Vec3.sub mappedTarget mappedOrig)

        mappedDir =
            Vec3.scale factor (Vec3.sub mappedTarget mappedOrig)
    in
    rayMeshIntersection mappedOrig mappedDir mesh center radius
        |> Maybe.map ((*) factor)
