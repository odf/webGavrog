module View3d exposing (main)

import AnimationFrame
import Char
import Html exposing (Html)
import Html.Attributes
import Html.Events
import Keyboard
import Mouse
import Math.Vector3 exposing (vec3, Vec3)
import Task
import Time exposing (Time)
import WebGL
import Window
import Camera
import Renderer
import WheelEvent
import Cube


type alias Model =
    { size : Window.Size
    , cameraState : Camera.State
    , mesh : WebGL.Mesh Renderer.Vertex
    , material : Renderer.Material
    , modifiers : { shift : Bool, ctrl : Bool }
    }


type Msg
    = ResizeMsg Window.Size
    | FrameMsg Time
    | MouseUpMsg Mouse.Position
    | MouseDownMsg
    | MouseMoveMsg Mouse.Position
    | KeyDownMsg Int
    | KeyUpMsg Int
    | WheelMsg Float


init : ( Model, Cmd Msg )
init =
    ( { size = { width = 0, height = 0 }
      , cameraState = Camera.initialState
      , mesh = Cube.cube
      , material = initMaterial
      , modifiers = { shift = False, ctrl = False }
      }
    , Task.perform ResizeMsg Window.size
    )


subscriptions : Model -> Sub Msg
subscriptions model =
    let
        animation =
            if Camera.isMoving model.cameraState then
                [ AnimationFrame.times FrameMsg ]
            else
                []
    in
        Sub.batch <|
            animation
                ++ [ Mouse.moves MouseMoveMsg
                   , Mouse.ups MouseUpMsg
                   , Keyboard.downs KeyDownMsg
                   , Keyboard.ups KeyUpMsg
                   , Window.resizes ResizeMsg
                   ]


updateCameraState :
    (Camera.State -> Camera.State)
    -> Model
    -> ( Model, Cmd Msg )
updateCameraState fn model =
    { model | cameraState = fn model.cameraState } ! []


lookAlong : Vec3 -> Vec3 -> Model -> ( Model, Cmd Msg )
lookAlong axis up model =
    updateCameraState (Camera.lookAlong axis up) model


handleKeyPress : Char.KeyCode -> Model -> ( Model, Cmd Msg )
handleKeyPress code model =
    let
        char =
            Char.toLower <| Char.fromCode code
    in
        case char of
            'a' ->
                lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model

            'b' ->
                lookAlong (vec3 -1 0 -1) (vec3 0 1 0) model

            'c' ->
                lookAlong (vec3 -1 -1 0) (vec3 0 1 0) model

            'd' ->
                lookAlong (vec3 -1 -1 -1) (vec3 0 1 0) model

            'x' ->
                lookAlong (vec3 -1 0 0) (vec3 0 1 0) model

            'y' ->
                lookAlong (vec3 0 -1 0) (vec3 0 0 -1) model

            'z' ->
                lookAlong (vec3 0 0 -1) (vec3 0 1 0) model

            _ ->
                model ! []


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


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ResizeMsg size ->
            updateCameraState (Camera.setFrameSize size) { model | size = size }

        FrameMsg time ->
            updateCameraState (Camera.nextFrame time) model

        MouseDownMsg ->
            updateCameraState Camera.startDragging model

        MouseUpMsg pos ->
            updateCameraState (Camera.finishDragging pos) model

        MouseMoveMsg pos ->
            updateCameraState
                (Camera.setMousePosition pos model.modifiers.shift)
                model

        WheelMsg val ->
            updateCameraState
                (Camera.updateZoom val model.modifiers.shift)
                model

        KeyDownMsg code ->
            setModifiers code True model ! []

        KeyUpMsg code ->
            handleKeyPress code <| setModifiers code False model


view : Model -> Html Msg
view model =
    let
        entities =
            [ Renderer.entity
                model.mesh
                model.material
                (Camera.cameraDistance model.cameraState)
                (Camera.viewingMatrix model.cameraState)
                (Camera.perspectiveMatrix model.cameraState)
            ]
    in
        WebGL.toHtml
            [ Html.Attributes.width model.size.width
            , Html.Attributes.height model.size.height
            , Html.Attributes.style
                [ ( "display", "block" )
                , ( "background", "black" )
                ]
            , Html.Attributes.id "main-3d-canvas"
            , Html.Events.onMouseDown MouseDownMsg
            , WheelEvent.onMouseWheel WheelMsg
            ]
            entities


main : Program Never Model Msg
main =
    Html.program
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }


initMaterial : Renderer.Material
initMaterial =
    { ambientColor = vec3 1 1 2
    , diffuseColor = vec3 1 1 1
    , specularColor = vec3 1 1 1
    , ka = 0.1
    , kd = 1.0
    , ks = 0.2
    , shininess = 20.0
    }
