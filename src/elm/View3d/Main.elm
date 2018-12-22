module View3d.Main exposing
    ( Model
    , Msg
    , Outcome(..)
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
import Html exposing (Html)
import Html.Attributes
import Html.Events
import Html.Events.Extra.Touch as Touch
import Json.Decode as Decode
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Time exposing (Posix)
import View3d.Camera as Camera
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.Renderer as Renderer
import View3d.Scene as Scene exposing (Scene)
import WebGL



-- MODEL


type alias FrameSize =
    { width : Float, height : Float }


type alias PickingScene =
    List
        { mesh : Mesh Vec3
        , inverseTransform : Mat4
        , idxMesh : Int
        , idxInstance : Int
        }


type alias Model =
    { size : FrameSize
    , cameraState : Camera.State
    , pickingRay : Maybe Camera.Ray
    , scene : Renderer.Scene
    , pickingScene : PickingScene
    , center : Vec3
    , radius : Float
    , modifiers : { shift : Bool, ctrl : Bool }
    }


type Outcome
    = None
    | Picked
        { modelIndex : Int
        , instanceIndex : Int
        , modifiers : { shift : Bool, ctrl : Bool }
        }


init : Model
init =
    { size = { width = 0, height = 0 }
    , cameraState = Camera.initialState
    , pickingRay = Nothing
    , scene = []
    , pickingScene = []
    , center = vec3 0 0 0
    , radius = 0
    , modifiers = { shift = False, ctrl = False }
    }


glMesh : Mesh Renderer.Vertex -> WebGL.Mesh Renderer.Vertex
glMesh mesh =
    case mesh of
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.Triangles triangles ->
            WebGL.triangles triangles

        Mesh.IndexedTriangles vertices triangles ->
            WebGL.indexedTriangles vertices triangles


glScene : Scene -> Renderer.Scene
glScene scene =
    List.concatMap
        (\entry ->
            let
                mesh =
                    glMesh entry.mesh
            in
            List.map
                (\{ material, transform } ->
                    { mesh = mesh, material = material, transform = transform }
                )
                entry.instances
        )
        scene


pickingMesh : Mesh Renderer.Vertex -> Maybe (Mesh Vec3)
pickingMesh mesh =
    case mesh of
        Mesh.Lines lines ->
            Nothing

        Mesh.Triangles triangles ->
            List.map (\( u, v, w ) -> ( u.pos, v.pos, w.pos )) triangles
                |> Mesh.Triangles
                |> Just

        Mesh.IndexedTriangles vertices triangles ->
            Just
                (Mesh.resolvedSurface
                    (List.map (\v -> v.pos) vertices)
                    (List.map (\( i, j, k ) -> [ i, j, k ]) triangles)
                )


pickingScene : Scene -> PickingScene
pickingScene scene =
    let
        convertInstances ( mesh, instances, idxMesh ) =
            instances
                |> List.indexedMap
                    (\idxInstance { transform } ->
                        ( transform, idxInstance )
                    )
                |> List.filterMap
                    (\( transform, idxInstance ) ->
                        Mat4.inverse transform
                            |> Maybe.map (\inv -> ( inv, idxInstance ))
                    )
                |> List.map
                    (\( inv, idxInstance ) ->
                        { mesh = mesh
                        , inverseTransform = inv
                        , idxMesh = idxMesh
                        , idxInstance = idxInstance
                        }
                    )
    in
    scene
        |> List.indexedMap
            (\idxMesh { mesh, instances } -> ( mesh, instances, idxMesh ))
        |> List.filterMap
            (\( mesh, instances, idxMesh ) ->
                pickingMesh mesh
                    |> Maybe.map (\m -> ( m, instances, idxMesh ))
            )
        |> List.concatMap convertInstances


minimumBy : (a -> comparable) -> List a -> Maybe a
minimumBy fn xs =
    List.foldl
        (\x acc ->
            case acc of
                Nothing ->
                    Just x

                Just val ->
                    if fn x < fn val then
                        Just x

                    else
                        acc
        )
        Nothing
        xs


pick : Camera.Ray -> PickingScene -> Maybe ( Int, Int )
pick ray pscene =
    let
        step { mesh, inverseTransform, idxMesh, idxInstance } bestSoFar =
            let
                intersection =
                    Mesh.mappedRayMeshIntersection
                        ray.origin
                        ray.direction
                        inverseTransform
                        mesh
            in
            case intersection of
                Nothing ->
                    bestSoFar

                Just tNew ->
                    case bestSoFar of
                        Nothing ->
                            Just ( tNew, idxMesh, idxInstance )

                        Just ( tOld, _, _ ) ->
                            if tNew < tOld then
                                Just ( tNew, idxMesh, idxInstance )

                            else
                                bestSoFar
    in
    pscene
        |> List.foldl step Nothing
        |> Maybe.map (\( _, idxMesh, idxInstance ) -> ( idxMesh, idxInstance ))



-- SUBSCRIPTIONS


type alias Position =
    { x : Float, y : Float }


type Msg
    = FrameMsg Float
    | MouseUpMsg Position
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
        :: [ Events.onMouseUp (Decode.map MouseUpMsg decodePos)
           , Events.onKeyDown (Decode.map KeyDownMsg decodeKey)
           , Events.onKeyUp (Decode.map KeyUpMsg decodeKey)
           ]
        |> Sub.batch
        |> Sub.map toMsg



-- UPDATE


update : Msg -> Model -> ( Model, Outcome )
update msg model =
    let
        alter =
            model.modifiers.shift
    in
    case msg of
        FrameMsg time ->
            ( updateCamera (Camera.nextFrame time) model, None )

        MouseDownMsg pos ->
            ( updateCamera (Camera.startDragging pos) model, None )

        MouseUpMsg pos ->
            let
                outcome =
                    if Camera.wasDragged model.cameraState then
                        None

                    else
                        pickingOutcome pos model
            in
            ( updateCamera Camera.finishDragging model, outcome )

        MouseMoveMsg pos ->
            ( updateCamera (Camera.dragTo pos alter) model, None )

        TouchStartMsg posList ->
            ( touchStartUpdate posList model, None )

        TouchMoveMsg posList ->
            ( touchMoveUpdate posList model, None )

        TouchEndMsg ->
            ( updateCamera Camera.finishDragging model, None )

        WheelMsg val ->
            ( updateCamera (Camera.updateZoom (wheelZoomFactor val) alter) model
            , None
            )

        KeyDownMsg code ->
            ( setModifiers code True model, None )

        KeyUpMsg code ->
            ( setModifiers code False model, None )


pickingOutcome : Position -> Model -> Outcome
pickingOutcome pos model =
    Camera.pickingRay pos model.cameraState
        |> Maybe.andThen
            (\r -> pick r model.pickingScene)
        |> Maybe.map
            (\( m, i ) ->
                Picked
                    { modelIndex = m
                    , instanceIndex = i
                    , modifiers = model.modifiers
                    }
            )
        |> Maybe.withDefault
            None


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
    { model
        | scene = glScene scene
        , pickingScene = pickingScene scene
        , center = center
        , radius = radius
    }
        |> lookAlong (vec3 0 0 -1) (vec3 0 1 0)
        |> encompass


setRedraws : Bool -> Model -> Model
setRedraws onOff model =
    updateCamera (Camera.setRedraws onOff) model



-- VIEW


view : (Msg -> msg) -> Model -> Html msg
view toMsg model =
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
        (Renderer.entities
            model.scene
            (Camera.cameraDistance model.cameraState)
            (Camera.viewingMatrix model.cameraState)
            (Camera.perspectiveMatrix model.cameraState)
        )


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
