module View3d exposing
    ( Model
    , Msg
    , encompass
    , init
    , lookAlong
    , setRedraws
    , setScene
    , setSize
    , subscriptions
    , update
    , view
    )

import Browser.Events as Events
import Camera
import Html exposing (Html)
import Html.Attributes
import Html.Events
import Html.Events.Extra.Touch as Touch
import Json.Decode as Decode
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Mesh exposing (..)
import Renderer
import Scene exposing (..)
import Time exposing (Posix)
import WebGL



-- MODEL


type alias Model =
    { size : { width : Int, height : Int }
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


type alias Position =
    { x : Int, y : Int }


type Msg
    = FrameMsg Float
    | MouseUpMsg
    | MouseDownMsg Position
    | MouseMoveMsg Position
    | KeyDownMsg Int
    | KeyUpMsg Int
    | WheelMsg Float


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = x, y = y })
        (Decode.at [ "clientX" ] Decode.int)
        (Decode.at [ "clientY" ] Decode.int)


subscriptions : (Msg -> msg) -> Model -> Sub msg
subscriptions toMsg model =
    let
        decodeKey =
            Decode.at [ "keyCode" ] Decode.int

        frameEvent =
            if Camera.isMoving model.cameraState then
                Events.onAnimationFrameDelta FrameMsg

            else
                Sub.none

        moveEvent =
            if Camera.isDragging model.cameraState then
                Events.onMouseMove (Decode.map MouseMoveMsg decodePos)

            else
                Sub.none
    in
    frameEvent
        :: moveEvent
        :: [ Events.onMouseUp (Decode.succeed MouseUpMsg)
           , Events.onKeyDown (Decode.map KeyDownMsg decodeKey)
           , Events.onKeyUp (Decode.map KeyUpMsg decodeKey)
           ]
        |> Sub.batch
        |> Sub.map toMsg



-- UPDATE


update : Msg -> Model -> Model
update msg model =
    case msg of
        FrameMsg time ->
            updateCamera (Camera.nextFrame time) model

        MouseDownMsg pos ->
            updateCamera (Camera.startDragging pos) model

        MouseUpMsg ->
            updateCamera Camera.finishDragging model

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


setModifiers : Int -> Bool -> Model -> Model
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


setSize : { width : Int, height : Int } -> Model -> Model
setSize size model =
    updateCamera (Camera.setFrameSize size) { model | size = size }


setScene : RawSceneSpec -> Model -> Model
setScene spec model =
    let
        scene =
            makeScene spec

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
        [ Html.Attributes.style "display" "block"
        , Html.Attributes.style "background" "white"
        , Html.Attributes.id "main-3d-canvas"
        , Html.Attributes.width model.size.width
        , Html.Attributes.height model.size.height
        , onMouseDown (toMsg << MouseDownMsg)
        , onMouseWheel (toMsg << WheelMsg)
        , onTouchStart (toMsg << MouseDownMsg)
        , onTouchMove (toMsg << MouseMoveMsg)
        , onTouchEnd (toMsg MouseUpMsg)
        , onTouchCancel (toMsg MouseUpMsg)
        ]
        entities


onMouseDown : (Position -> msg) -> Html.Attribute msg
onMouseDown toMsg =
    let
        toResult value =
            { message = toMsg value
            , stopPropagation = False
            , preventDefault = False
            }
    in
    Html.Events.custom
        "mousedown"
        (Decode.map toResult decodePos)


onMouseWheel : (Float -> msg) -> Html.Attribute msg
onMouseWheel toMsg =
    let
        toResult value =
            { message = toMsg value
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Html.Events.custom
        "wheel"
        (Decode.map toResult <| Decode.at [ "deltaY" ] Decode.float)


touchCoordinates : Touch.Event -> Position
touchCoordinates touchEvent =
    List.head (Debug.log "touch event" touchEvent).changedTouches
        |> Maybe.map .clientPos
        |> Maybe.withDefault ( 0, 0 )
        |> (\( x, y ) -> { x = round x, y = round y })


onTouchStart : (Position -> msg) -> Html.Attribute msg
onTouchStart toMsg =
    Touch.onStart (toMsg << touchCoordinates)


onTouchMove : (Position -> msg) -> Html.Attribute msg
onTouchMove toMsg =
    Touch.onMove (toMsg << touchCoordinates)


onTouchEnd : msg -> Html.Attribute msg
onTouchEnd theMsg =
    Touch.onEnd (\e -> theMsg)


onTouchCancel : msg -> Html.Attribute msg
onTouchCancel theMsg =
    Touch.onCancel (\e -> theMsg)
