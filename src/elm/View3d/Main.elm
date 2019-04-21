module View3d.Main exposing
    ( Model
    , Msg
    , Outcome(..)
    , encompass
    , init
    , lookAlong
    , requestRedraw
    , rotateBy
    , setScene
    , setSelection
    , setSize
    , subscriptions
    , update
    , view
    )

import Bitwise
import Browser.Events as Events
import Color exposing (Color)
import DOM
import Html exposing (Html)
import Html.Attributes
import Html.Events
import Html.Events.Extra.Touch as Touch
import Json.Decode as Decode
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Set exposing (Set)
import Time exposing (Posix)
import View3d.Camera as Camera
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.Renderer as Renderer
import View3d.Scene as Scene exposing (Scene)
import WebGL



-- MODEL


type alias FrameSize =
    { width : Float, height : Float }


type alias Position =
    { x : Float, y : Float }


type alias PickingInfo =
    { centroid : Vec3
    , radius : Float
    , pickingMesh : Maybe (Mesh Vec3)
    , inverseTransform : Maybe Mat4
    }


type alias Model =
    { size : FrameSize
    , requestRedraw : Bool
    , cameraState : Camera.State
    , scene : Renderer.Scene PickingInfo
    , selected : Set ( Int, Int )
    , touchStart : Position
    , center : Vec3
    , radius : Float
    }


type Outcome
    = None
    | PickEmpty Touch.Keys
    | Pick Touch.Keys { meshIndex : Int, instanceIndex : Int }


init : Model
init =
    { size = { width = 0, height = 0 }
    , requestRedraw = False
    , cameraState = Camera.initialState
    , scene = []
    , selected = Set.empty
    , touchStart = { x = 0, y = 0 }
    , center = vec3 0 0 0
    , radius = 0
    }


meshForRenderer : Mesh Renderer.Vertex -> WebGL.Mesh Renderer.Vertex
meshForRenderer mesh =
    case mesh of
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.Triangles triangles ->
            WebGL.triangles triangles

        Mesh.IndexedTriangles vertices triangles ->
            WebGL.indexedTriangles vertices triangles


wireframeForRenderer : Mesh Renderer.Vertex -> WebGL.Mesh Renderer.Vertex
wireframeForRenderer mesh =
    let
        out { pos, normal } =
            { pos = Vec3.add pos (Vec3.scale 0.001 normal)
            , normal = normal
            }
    in
    case mesh of
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.Triangles triangles ->
            triangles
                |> List.map
                    (\( u, v, w ) -> ( out u, out v, out w ))
                |> List.concatMap
                    (\( u, v, w ) -> [ ( u, v ), ( v, w ), ( w, u ) ])
                |> WebGL.lines

        Mesh.IndexedTriangles vertices triangles ->
            Mesh.resolvedSurface
                vertices
                (List.map (\( i, j, k ) -> [ i, j, k ]) triangles)
                |> wireframeForRenderer


meshForPicking : Mesh Renderer.Vertex -> Maybe (Mesh Vec3)
meshForPicking mesh =
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


processedScene : Scene -> Renderer.Scene PickingInfo
processedScene scene =
    scene
        |> List.indexedMap
            (\idxMesh { mesh, instances } -> ( mesh, instances, idxMesh ))
        |> List.concatMap
            (\( rawMesh, instances, idxMesh ) ->
                let
                    mesh =
                        meshForRenderer rawMesh

                    wireframe =
                        wireframeForRenderer rawMesh

                    pickingMesh =
                        meshForPicking rawMesh

                    vertices =
                        List.map .pos (Mesh.getVertices rawMesh)

                    n =
                        List.length vertices

                    centroid =
                        vertices
                            |> List.foldl Vec3.add (vec3 0 0 0)
                            |> Vec3.scale (1 / toFloat n)

                    radius =
                        vertices
                            |> List.map (\v -> Vec3.distance v centroid)
                            |> List.maximum
                            |> Maybe.withDefault 0.0
                in
                List.indexedMap
                    (\idxInstance { material, transform } ->
                        { mesh = mesh
                        , wireframe = wireframe
                        , pickingMesh = pickingMesh
                        , centroid = centroid
                        , radius = radius
                        , material = material
                        , transform = transform
                        , inverseTransform = Mat4.inverse transform
                        , idxMesh = idxMesh
                        , idxInstance = idxInstance
                        }
                    )
                    instances
            )


pick : Camera.Ray -> Renderer.Scene PickingInfo -> Maybe ( Int, Int )
pick ray pscene =
    let
        intersect =
            Mesh.mappedRayMeshIntersection ray.origin ray.direction

        step item bestSoFar =
            let
                mat =
                    item.inverseTransform

                mesh =
                    item.pickingMesh

                c =
                    item.centroid

                r =
                    item.radius

                intersection =
                    Maybe.map2 Tuple.pair mat mesh
                        |> Maybe.andThen (\( t, m ) -> intersect t m c r)
            in
            case intersection of
                Nothing ->
                    bestSoFar

                Just tNew ->
                    case bestSoFar of
                        Nothing ->
                            Just ( tNew, item.idxMesh, item.idxInstance )

                        Just ( tOld, _, _ ) ->
                            if tNew < tOld then
                                Just ( tNew, item.idxMesh, item.idxInstance )

                            else
                                bestSoFar
    in
    pscene
        |> List.foldl step Nothing
        |> Maybe.map (\( _, idxMesh, idxInstance ) -> ( idxMesh, idxInstance ))



-- SUBSCRIPTIONS


type alias Buttons =
    { left : Bool, right : Bool, middle : Bool }


type Msg
    = FrameMsg Float
    | MouseUpMsg Position Touch.Keys
    | MouseDownMsg Position Touch.Keys Buttons
    | MouseMoveMsg Position Touch.Keys
    | TouchStartMsg (List Position)
    | TouchMoveMsg (List Position)
    | TouchEndMsg
    | WheelMsg Float Touch.Keys


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = toFloat x, y = toFloat y })
        (Decode.at [ "offsetX" ] Decode.int)
        (Decode.at [ "offsetY" ] Decode.int)


decodeModifiers : Decode.Decoder Touch.Keys
decodeModifiers =
    Decode.map3 (\alt ctrl shift -> { alt = alt, ctrl = ctrl, shift = shift })
        (Decode.at [ "altKey" ] Decode.bool)
        (Decode.at [ "ctrlKey" ] Decode.bool)
        (Decode.at [ "shiftKey" ] Decode.bool)


decodeButtons : Decode.Decoder Buttons
decodeButtons =
    Decode.map
        (\val ->
            { left = Bitwise.and val 1 > 0
            , right = Bitwise.and val 2 > 0
            , middle = Bitwise.and val 4 > 0
            }
        )
        (Decode.at [ "buttons" ] Decode.int)


decodePosList : Decode.Decoder (List Position)
decodePosList =
    Decode.map
        (List.map (.clientPos >> (\( x, y ) -> { x = x, y = y })))
        (Decode.field
            "changedTouches"
            (Touch.touchListDecoder Touch.touchDecoder)
        )


decodeOffset : Decode.Decoder DOM.Rectangle
decodeOffset =
    DOM.target DOM.boundingClientRect


onTouchEvent : String -> (List Position -> msg) -> Html.Attribute msg
onTouchEvent eventString toMsg =
    let
        adjust { top, left } { x, y } =
            { x = x - left, y = y - top }

        toResult posList rect =
            { message = posList |> List.map (adjust rect) |> toMsg
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Html.Events.custom
        eventString
        (Decode.map2 toResult decodePosList decodeOffset)


subscriptions : (Msg -> msg) -> Model -> Sub msg
subscriptions toMsg model =
    let
        frameEvent =
            if
                model.requestRedraw
                    || Camera.needsFrameEvents model.cameraState
            then
                Events.onAnimationFrameDelta FrameMsg

            else
                Sub.none

        decoder msg =
            Decode.map2 msg decodePos decodeModifiers

        mouseEvents =
            if Camera.needsMouseEvents model.cameraState then
                [ Events.onMouseMove (decoder MouseMoveMsg)
                , Events.onMouseUp (decoder MouseUpMsg)
                ]

            else
                []
    in
    (frameEvent :: mouseEvents)
        |> Sub.batch
        |> Sub.map toMsg



-- UPDATE


update : Msg -> Model -> ( Model, Outcome )
update msg model =
    case msg of
        FrameMsg time ->
            ( updateCamera (Camera.nextFrame time)
                { model | requestRedraw = False }
            , None
            )

        MouseDownMsg pos modifiers buttons ->
            if buttons.right then
                ( model, None )

            else
                ( updateCamera (Camera.startDragging pos)
                    { model | touchStart = pos }
                , None
                )

        MouseUpMsg pos modifiers ->
            let
                outcome =
                    if Camera.wasDragged model.cameraState then
                        None

                    else
                        pickingOutcome model.touchStart modifiers model
            in
            ( updateCamera Camera.finishDragging model, outcome )

        MouseMoveMsg pos modifiers ->
            ( updateCamera (Camera.dragTo pos modifiers.shift) model, None )

        TouchStartMsg posList ->
            ( touchStartUpdate posList model, None )

        TouchMoveMsg posList ->
            ( touchMoveUpdate posList model, None )

        TouchEndMsg ->
            let
                outcome =
                    if Camera.wasDragged model.cameraState then
                        None

                    else
                        pickingOutcome
                            model.touchStart
                            { alt = True, ctrl = False, shift = False }
                            model
            in
            ( updateCamera Camera.finishDragging model, outcome )

        WheelMsg val modifiers ->
            ( updateCamera
                (Camera.updateZoom (wheelZoomFactor val) modifiers.shift)
                model
            , None
            )


pickingOutcome : Position -> Touch.Keys -> Model -> Outcome
pickingOutcome pos mods model =
    Camera.pickingRay pos model.cameraState
        |> Maybe.andThen
            (\r -> pick r model.scene)
        |> Maybe.map
            (\( m, i ) -> Pick mods { meshIndex = m, instanceIndex = i })
        |> Maybe.withDefault
            (PickEmpty mods)


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
            { model | touchStart = pos }
                |> updateCamera (Camera.startDragging pos)

        posA :: posB :: [] ->
            updateCamera (Camera.startPinching posA posB) model

        posA :: posB :: posC :: [] ->
            updateCamera (Camera.startDragging <| centerPosition posList) model

        _ ->
            model


touchMoveUpdate : List Position -> Model -> Model
touchMoveUpdate posList model =
    case posList of
        pos :: [] ->
            updateCamera (Camera.dragTo pos False) model

        posA :: posB :: [] ->
            updateCamera (Camera.pinchTo posA posB False) model

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


lookAlong : Vec3 -> Vec3 -> Model -> Model
lookAlong axis up model =
    updateCamera (Camera.lookAlong axis up) model


rotateBy : Vec3 -> Float -> Model -> Model
rotateBy axis angle model =
    updateCamera (Camera.rotateBy axis angle) model


encompass : Model -> Model
encompass model =
    updateCamera (Camera.encompass model.center model.radius) model


setSize : FrameSize -> Model -> Model
setSize size model =
    updateCamera (Camera.setFrameSize size) { model | size = size }


setScene : Scene -> Model -> Model
setScene rawScene model =
    let
        scene =
            processedScene rawScene

        n =
            List.length scene

        sceneCenter =
            scene
                |> List.foldl
                    (\{ centroid, transform } sum ->
                        Vec3.add sum (Mat4.transform transform centroid)
                    )
                    (vec3 0 0 0)
                |> Vec3.scale (1 / toFloat n)

        sceneRadius =
            scene
                |> List.map
                    (\{ centroid, radius, transform } ->
                        radius
                            + Vec3.distance
                                sceneCenter
                                (Mat4.transform transform centroid)
                    )
                |> List.maximum
                |> Maybe.withDefault 0.0
    in
    { model
        | scene = scene
        , selected = Set.empty
        , center = sceneCenter
        , radius = sceneRadius
    }


setSelection : Set ( Int, Int ) -> Model -> Model
setSelection selected model =
    { model | selected = selected }


requestRedraw : Model -> Model
requestRedraw model =
    { model | requestRedraw = True }



-- VIEW


view : (Msg -> msg) -> Model -> Renderer.Options -> Color -> Html msg
view toMsg model options bgColor =
    WebGL.toHtml
        [ Html.Attributes.style "display" "block"
        , Html.Attributes.style "background" (Color.toCssString bgColor)
        , Html.Attributes.id "main-3d-canvas"
        , Html.Attributes.width (floor model.size.width)
        , Html.Attributes.height (floor model.size.height)
        , onMouseDown
            (\pos mods buttons -> toMsg (MouseDownMsg pos mods buttons))
        , onMouseWheel
            (\dy mods -> toMsg (WheelMsg dy mods))
        , onTouchStart
            (toMsg << TouchStartMsg)
        , onTouchMove
            (toMsg << TouchMoveMsg)
        , onTouchEnd
            (toMsg TouchEndMsg)
        , onTouchCancel
            (toMsg TouchEndMsg)
        ]
        (Renderer.entities
            model.scene
            model.center
            model.radius
            options
            model.selected
            (Camera.cameraDistance model.cameraState)
            (Camera.viewingMatrix model.cameraState)
            (Camera.perspectiveMatrix model.cameraState)
        )


onMouseDown : (Position -> Touch.Keys -> Buttons -> msg) -> Html.Attribute msg
onMouseDown toMsg =
    let
        toResult pos mods buttons =
            { message = toMsg pos mods buttons
            , stopPropagation = False
            , preventDefault = False
            }
    in
    Html.Events.custom
        "mousedown"
        (Decode.map3 toResult decodePos decodeModifiers decodeButtons)


onMouseWheel : (Float -> Touch.Keys -> msg) -> Html.Attribute msg
onMouseWheel toMsg =
    let
        toResult dy mods =
            { message = toMsg dy mods
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Html.Events.custom
        "wheel"
        (Decode.map2
            toResult
            (Decode.at [ "deltaY" ] Decode.float)
            decodeModifiers
        )


onTouchStart : (List Position -> msg) -> Html.Attribute msg
onTouchStart toMsg =
    onTouchEvent "touchstart" toMsg


onTouchMove : (List Position -> msg) -> Html.Attribute msg
onTouchMove toMsg =
    Touch.onMove
        (.targetTouches
            >> List.map .clientPos
            >> List.map (\( x, y ) -> { x = x, y = y })
            >> toMsg
        )


onTouchEnd : msg -> Html.Attribute msg
onTouchEnd theMsg =
    Touch.onEnd (\e -> theMsg)


onTouchCancel : msg -> Html.Attribute msg
onTouchCancel theMsg =
    Touch.onCancel (\e -> theMsg)
