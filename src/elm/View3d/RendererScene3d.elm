module View3d.RendererScene3d exposing
    ( MaterialSpec
    , Mesh
    , Options
    , Scene
    , VertexSpec
    , indexedTriangles
    , lines
    , triangles
    , view
    )

import Angle
import Camera3d
import Color
import Direction3d
import Html exposing (Html)
import Length
import Pixels
import Point3d
import Scene3d
import Scene3d.Material as Material
import Viewpoint3d
import Html exposing (Html)
import Math.Matrix4 exposing (Mat4)
import Math.Vector3 exposing (Vec3)
import Set exposing (Set)



-- The mesh type and mesh generating functions are placeholders for now


type alias Mesh attributes =
    List attributes


lines : List ( attributes, attributes ) -> Mesh attributes
lines xs =
    []


triangles : List ( attributes, attributes, attributes ) -> Mesh attributes
triangles xs =
    []


indexedTriangles : List attributes -> List ( Int, Int, Int ) -> Mesh attributes
indexedTriangles xs ys =
    []


type alias VertexSpec =
    { pos : Vec3
    , normal : Vec3
    }


type alias MaterialSpec =
    { ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Scene a =
    List
        { a
            | mesh : Mesh VertexSpec
            , wireframe : Mesh VertexSpec
            , material : MaterialSpec
            , transform : Mat4
            , idxMesh : Int
            , idxInstance : Int
        }


type alias Options =
    { orthogonalView : Bool
    , drawWires : Bool
    , fadeToBackground : Float
    , fadeToBlue : Float
    , backgroundColor : Vec3
    , addOutlines : Bool
    , outlineColor : Vec3
    }


view :
    List (Html.Attribute msg)
    -> Scene a
    -> Vec3
    -> Float
    -> Options
    -> Set ( Int, Int )
    -> Float
    -> Mat4
    -> Mat4
    -> Html msg
view attr scene center radius options selected camDist viewing perspective =
    Scene3d.unlit
        { entities =
            [ Scene3d.quad (Material.color Color.blue)
                (Point3d.meters -1 -1 0)
                (Point3d.meters 1 -1 0)
                (Point3d.meters 1 1 0)
                (Point3d.meters -1 1 0)
            ]
        , camera =
            Camera3d.perspective
                { viewpoint =
                    Viewpoint3d.lookAt
                        { focalPoint = Point3d.origin
                        , eyePoint = Point3d.meters 5 2 3
                        , upDirection = Direction3d.positiveZ
                        }
                , verticalFieldOfView = Angle.degrees 30
                }
        , clipDepth = Length.meters 1
        , background = Scene3d.transparentBackground
        , dimensions = ( Pixels.pixels 800, Pixels.pixels 600 )
        }
