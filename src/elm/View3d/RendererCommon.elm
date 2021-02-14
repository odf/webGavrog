module View3d.RendererCommon exposing
    ( FrameSize
    , Instance
    , Material
    , Model
    , Options
    , Vertex
    )

import Color exposing (Color)
import Math.Matrix4 exposing (Mat4)
import Math.Vector3 exposing (Vec3)
import Set exposing (Set)
import View3d.Camera as Camera


type alias FrameSize =
    { width : Float, height : Float }


type alias Vertex =
    { position : Vec3
    , normal : Vec3
    }


type alias Material =
    { color : Color
    , roughness : Float
    , metallic : Float
    }


type alias Instance =
    { material : Material
    , transform : Mat4
    , idxMesh : Int
    , idxInstance : Int
    }


type alias Model a =
    { a
        | size : FrameSize
        , scene : List Instance
        , selected : Set ( Int, Int )
        , center : Vec3
        , radius : Float
        , cameraState : Camera.State
    }


type alias Options =
    { orthogonalView : Bool
    , drawWires : Bool
    , fadeToBackground : Float
    , fadeToBlue : Float
    , backgroundColor : Vec3
    , addOutlines : Bool
    , outlineWidth : Float
    , outlineColor : Vec3
    , drawShadows : Bool
    }
