module View3d
    exposing
        ( init
        , view
        , subscriptions
        , update
        , lookAlong
        , encompass
        , setSize
        , setScene
        , setRedraws
        , Model
        , Msg
        )

import AnimationFrame
import Char
import Html exposing (Html)
import Html.Attributes
import Html.Events
import Json.Decode as Json
import Keyboard
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (vec3, Vec3)
import Mouse
import Time exposing (Time)
import WebGL
import Camera
import Mesh exposing (..)
import Renderer
import Scene exposing (..)
import Window


-- MODEL


type alias Model =
    { size : Window.Size
    , cameraState : Camera.State
    , scene : GlScene
    , center : Vec3
    , radius : Float
    , modifiers : { shift : Bool, ctrl : Bool }
    }


type alias GlMesh =
    WebGL.Mesh Renderer.Vertex


type alias GlScene =
    List
        { mesh : GlMesh
        , instances :
            List
                { material : Renderer.Material
                , transform : Mat4
                }
        }


init : Model
init =
    { size = { width = 0, height = 0 }
    , cameraState = Camera.initialState
    , scene = []
    , center = vec3 0 0 0
    , radius = 0
    , modifiers = { shift = False, ctrl = False }
    }


glMesh : Mesh Renderer.Vertex -> GlMesh
glMesh mesh =
    case mesh of
        Lines lines ->
            WebGL.lines lines

        Triangles triangles ->
            WebGL.triangles triangles


glScene : Scene -> GlScene
glScene scene =
    List.map
        (\{ mesh, instances } ->
            { mesh = glMesh mesh
            , instances = instances
            }
        )
        scene



-- SUBSCRIPTIONS


type Msg
    = FrameMsg Time
    | MouseUpMsg Mouse.Position
    | MouseDownMsg
    | MouseMoveMsg Mouse.Position
    | KeyDownMsg Int
    | KeyUpMsg Int
    | WheelMsg Float


subscriptions : (Msg -> msg) -> Model -> Sub msg
subscriptions toMsg model =
    (if Camera.isMoving model.cameraState then
        [ AnimationFrame.times FrameMsg ]
     else
        []
    )
        ++ [ Mouse.moves MouseMoveMsg
           , Mouse.ups MouseUpMsg
           , Keyboard.downs KeyDownMsg
           , Keyboard.ups KeyUpMsg
           ]
        |> Sub.batch
        |> Sub.map toMsg



-- UPDATE


update : Msg -> Model -> Model
update msg model =
    case msg of
        FrameMsg time ->
            updateCamera (Camera.nextFrame time) model

        MouseDownMsg ->
            updateCamera Camera.startDragging model

        MouseUpMsg pos ->
            updateCamera (Camera.finishDragging pos) model

        MouseMoveMsg pos ->
            updateCamera
                (Camera.setMousePosition pos model.modifiers.shift)
                model

        WheelMsg val ->
            updateCamera
                (Camera.updateZoom val model.modifiers.shift)
                model

        KeyDownMsg code ->
            setModifiers code True model

        KeyUpMsg code ->
            setModifiers code False model


updateCamera : (Camera.State -> Camera.State) -> Model -> Model
updateCamera fn model =
    { model | cameraState = fn model.cameraState }


setModifiers : Char.KeyCode -> Bool -> Model -> Model
setModifiers keyCode value model =
    let
        oldModifiers =
            model.modifiers
    in
        if keyCode == 16 then
            { model | modifiers = { oldModifiers | shift = value } }
        else if keyCode == 17 then
            { model | modifiers = { oldModifiers | ctrl = value } }
        else
            model


lookAlong : Vec3 -> Vec3 -> Model -> Model
lookAlong axis up model =
    updateCamera (Camera.lookAlong axis up) model


encompass : Model -> Model
encompass model =
    updateCamera (Camera.encompass model.center model.radius) model


setSize : Window.Size -> Model -> Model
setSize size model =
    updateCamera (Camera.setFrameSize size) { model | size = size }


setScene : RawSceneSpec -> Model -> Model
setScene spec model =
    let
        scene =
            (Debug.log "scene" <| makeScene spec)

        box =
            boundingBoxForScene scene

        center =
            Vec3.add box.minima box.maxima |> Vec3.scale (1 / 2)

        radius =
            Vec3.length <| Vec3.sub box.minima center
    in
        { model | scene = glScene scene, center = center, radius = radius }
            |> lookAlong (vec3 0 0 -1) (vec3 0 1 0)
            |> encompass


setRedraws : Bool -> Model -> Model
setRedraws onOff model =
    updateCamera (Camera.setRedraws onOff) model



-- VIEW


view : (Msg -> msg) -> Model -> Html msg
view toMsg model =
    let
        viewing =
            Camera.viewingMatrix model.cameraState

        entities =
            List.concatMap
                (\{ mesh, instances } ->
                    List.map
                        (\{ material, transform } ->
                            Renderer.entity
                                mesh
                                material
                                (Camera.cameraDistance model.cameraState)
                                (Mat4.mul viewing transform)
                                (Camera.perspectiveMatrix model.cameraState)
                        )
                        instances
                )
                model.scene
    in
        WebGL.toHtml
            [ Html.Attributes.width model.size.width
            , Html.Attributes.height model.size.height
            , Html.Attributes.style
                [ ( "display", "block" )
                , ( "background", "white" )
                ]
            , Html.Attributes.id "main-3d-canvas"
            , Html.Events.onMouseDown (toMsg MouseDownMsg)
            , onMouseWheel (toMsg << WheelMsg)
            ]
            entities


onMouseWheel : (Float -> msg) -> Html.Attribute msg
onMouseWheel toMsg =
    Html.Events.onWithOptions
        "wheel"
        { stopPropagation = True
        , preventDefault = True
        }
        (Json.map toMsg <| Json.at [ "deltaY" ] Json.float)
