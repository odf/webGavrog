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
import Mesh exposing (Mesh)
import Renderer
import Scene exposing (Scene)
import Time exposing (Posix)
import WebGL



-- MODEL


type alias FrameSize =
    { width : Float, height : Float }


type alias Model =
    { size : FrameSize
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
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.IndexedTriangles vertices triangles ->
            WebGL.indexedTriangles vertices triangles


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
    { x : Float, y : Float }


type Msg
    = FrameMsg Float
    | MouseUpMsg
    | MouseDownMsg Position
    | MouseMoveMsg Position
    | TouchStartMsg (List Position)
    | TouchMoveMsg (List Position)
    | TouchEndMsg
    | KeyDownMsg Int
    | KeyUpMsg Int
    | WheelMsg Float


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = toFloat x, y = toFloat y })
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
    let
        alter =
            model.modifiers.shift
    in
    case msg of
        FrameMsg time ->
            updateCamera (Camera.nextFrame time) model

        MouseDownMsg pos ->
            updateCamera (Camera.startDragging pos) model

        MouseUpMsg ->
            updateCamera Camera.finishDragging model

        MouseMoveMsg pos ->
            updateCamera (Camera.dragTo pos alter) model

        TouchStartMsg posList ->
            touchStartUpdate posList model

        TouchMoveMsg posList ->
            touchMoveUpdate posList model

        TouchEndMsg ->
            updateCamera Camera.finishDragging model

        WheelMsg val ->
            updateCamera (Camera.updateZoom (wheelZoomFactor val) alter) model

        KeyDownMsg code ->
            setModifiers code True model

        KeyUpMsg code ->
            setModifiers code False model


centerPosition : List Position -> Position
centerPosition posList =
    let
        n =
            List.length posList |> max 1 |> toFloat

        sum =
            List.foldl (\p q -> { x = p.x + q.x, y = p.y + q.y })
                { x = 0, y = 0 }
                posList
    in
    { x = sum.x / n, y = sum.y / n }


touchStartUpdate : List Position -> Model -> Model
touchStartUpdate posList model =
    case posList of
        pos :: [] ->
            updateCamera (Camera.startDragging pos) model

        posA :: posB :: [] ->
            updateCamera (Camera.startPinching posA posB) model

        posA :: posB :: posC :: [] ->
            updateCamera (Camera.startDragging <| centerPosition posList) model

        _ ->
            model


touchMoveUpdate : List Position -> Model -> Model
touchMoveUpdate posList model =
    let
        alter =
            model.modifiers.shift
    in
    case posList of
        pos :: [] ->
            updateCamera (Camera.dragTo pos False) model

        posA :: posB :: [] ->
            updateCamera (Camera.pinchTo posA posB alter) model

        posA :: posB :: posC :: [] ->
            updateCamera (Camera.dragTo (centerPosition posList) True) model

        _ ->
            model


wheelZoomFactor : Float -> Float
wheelZoomFactor wheelVal =
    if wheelVal > 0 then
        0.9

    else if wheelVal < 0 then
        1.0 / 0.9

    else
        1.0


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


setSize : FrameSize -> Model -> Model
setSize size model =
    updateCamera (Camera.setFrameSize size) { model | size = size }


setScene : Scene.RawSceneSpec -> Model -> Model
setScene spec model =
    let
        box =
            Scene.boundingBox spec

        scene =
            Scene.makeScene spec

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
        , Html.Attributes.width (floor model.size.width)
        , Html.Attributes.height (floor model.size.height)
        , onMouseDown (toMsg << MouseDownMsg)
        , onMouseWheel (toMsg << WheelMsg)
        , onTouchStart (toMsg << TouchStartMsg)
        , onTouchMove (toMsg << TouchMoveMsg)
        , onTouchEnd (toMsg TouchEndMsg)
        , onTouchCancel (toMsg TouchEndMsg)
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


touchCoordinates : Touch.Event -> List Position
touchCoordinates touchEvent =
    touchEvent.targetTouches
        |> List.map .clientPos
        |> List.map (\( x, y ) -> { x = x, y = y })


onTouchStart : (List Position -> msg) -> Html.Attribute msg
onTouchStart toMsg =
    Touch.onStart (toMsg << touchCoordinates)


onTouchMove : (List Position -> msg) -> Html.Attribute msg
onTouchMove toMsg =
    Touch.onMove (toMsg << touchCoordinates)


onTouchEnd : msg -> Html.Attribute msg
onTouchEnd theMsg =
    Touch.onEnd (\e -> theMsg)


onTouchCancel : msg -> Html.Attribute msg
onTouchCancel theMsg =
    Touch.onCancel (\e -> theMsg)
