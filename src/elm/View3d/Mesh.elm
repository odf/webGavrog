module View3d.Mesh exposing
    ( Mesh(..)
    , getVertices
    , invertMesh
    , mapVertices
    , mappedRayMeshIntersection
    , resolvedSurface
    , surface
    )

import Array exposing (Array)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3)


type Mesh vertex
    = Triangles (List ( vertex, vertex, vertex ))
    | IndexedTriangles (List vertex) (List ( Int, Int, Int ))


type alias FaceSpec =
    List Int


pullCorners : Array vertex -> FaceSpec -> List vertex
pullCorners vertices face =
    List.filterMap (\i -> Array.get i vertices) face


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


surface : List vertex -> List FaceSpec -> Mesh vertex
surface vertices faces =
    List.concatMap makeTriangles faces
        |> IndexedTriangles vertices


resolvedSurface : List vertex -> List FaceSpec -> Mesh vertex
resolvedSurface vertices faces =
    let
        averts =
            Array.fromList vertices
    in
    List.concatMap (makeTriangles << pullCorners averts) faces
        |> Triangles


getVertices : Mesh vertex -> List vertex
getVertices mesh =
    case mesh of
        Triangles triangles ->
            triangles
                |> List.concatMap (\( u, v, w ) -> [ u, v, w ])

        IndexedTriangles vertices _ ->
            vertices


mapVertices : (a -> b) -> Mesh a -> Mesh b
mapVertices fn mesh =
    case mesh of
        Triangles triangles ->
            triangles
                |> List.map (\( p, q, r ) -> ( fn p, fn q, fn r ))
                |> Triangles

        IndexedTriangles vertices triangles ->
            IndexedTriangles (List.map fn vertices) triangles


invertMesh : Mesh a -> Mesh a
invertMesh mesh =
    case mesh of
        Triangles triangles ->
            triangles
                |> List.map (\( p, q, r ) -> ( r, q, p ))
                |> Triangles

        IndexedTriangles vertices triangles ->
            triangles
                |> List.map (\( p, q, r ) -> ( r, q, p ))
                |> IndexedTriangles vertices



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
            Triangles triangles ->
                intersect triangles

            IndexedTriangles vertices triplets ->
                let
                    averts =
                        Array.fromList vertices
                in
                triplets
                    |> List.map (\( i, j, k ) -> [ i, j, k ])
                    |> List.concatMap (makeTriangles << pullCorners averts)
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
