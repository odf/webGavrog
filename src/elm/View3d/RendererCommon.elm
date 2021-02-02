module View3d.RendererCommon exposing
    ( MaterialSpec
    , Options
    , Scene
    , VertexSpec
    )

import Math.Matrix4 exposing (Mat4)
import Math.Vector3 exposing (Vec3)


type alias VertexSpec =
    { position : Vec3
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


type alias Scene =
    List
        { material : MaterialSpec
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
