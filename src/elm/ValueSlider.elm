module ValueSlider exposing (Background(..), Config, view)

import Bitwise
import DOM
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events
import Html
import Html.Attributes
import Html.Events
import Html.Events.Extra.Touch as Touch
import Json.Decode as Decode


type Background a
    = BackgroundElement (Element.Element a)
    | BackgroundColor Element.Color
    | BackgroundDefault


type alias Config a =
    { minimum : Float
    , maximum : Float
    , step : Maybe Float
    , precision : Int
    , widthPx : Int
    , heightPx : Int
    , thumbColor : Element.Color
    , background : Background a
    }


type alias Position =
    { x : Int
    , y : Int
    }


type alias Buttons =
    { left : Bool
    , right : Bool
    , middle : Bool
    }


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = x, y = y })
        (Decode.at [ "offsetX" ] Decode.int)
        (Decode.at [ "offsetY" ] Decode.int)


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
        (List.map (.clientPos >> (\( x, y ) -> { x = round x, y = round y })))
        (Decode.field
            "changedTouches"
            (Touch.touchListDecoder Touch.touchDecoder)
        )


decodeOffset : Decode.Decoder DOM.Rectangle
decodeOffset =
    DOM.target DOM.boundingClientRect


onMouseEvent : String -> (Position -> Buttons -> msg) -> Html.Attribute msg
onMouseEvent eventString toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Html.Events.custom
        eventString
        (Decode.map2 toResult decodePos decodeButtons)


onTouchEvent : String -> (List Position -> msg) -> Html.Attribute msg
onTouchEvent eventString toMsg =
    let
        adjust { top, left } { x, y } =
            { x = x - round left, y = y - round top }

        toResult posList rect =
            { message = posList |> List.map (adjust rect) |> toMsg
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Html.Events.custom
        eventString
        (Decode.map2 toResult decodePosList decodeOffset)


defaultBackground : Element.Color -> Element.Element msg
defaultBackground color =
    Element.el
        [ Element.centerY
        , Element.width Element.fill
        , Element.height <| Element.px 6
        , Background.color <| color
        , Border.innerShadow
            { offset = ( 0.0, 1.0 )
            , size = 1.0
            , blur = 2.0
            , color = Element.rgba 0.0 0.0 0.0 0.5
            }
        ]
        Element.none


format : Int -> Float -> String
format precision value =
    let
        base =
            10 ^ precision

        sign =
            if value < 0 then
                "-"

            else
                ""

        n =
            round (abs value * toFloat base)

        head =
            String.fromInt (n // base)

        tail =
            String.fromInt (remainderBy base n + base) |> String.dropLeft 1
    in
    if precision > 0 then
        sign ++ head ++ "." ++ tail

    else
        sign ++ head


roundTo : Maybe Float -> Float -> Float
roundTo step val =
    case step of
        Just s ->
            s * toFloat (round (val / s))

        Nothing ->
            val


view : (Float -> Bool -> msg) -> Config msg -> Float -> Element.Element msg
view toMsg config value =
    let
        { widthPx, heightPx, minimum, maximum, step } =
            config

        position =
            ((value - minimum) / (maximum - minimum))
                |> clamp 0.0 1.0
                |> (*) (toFloat widthPx)

        positionToValue pos =
            (toFloat pos / toFloat widthPx)
                |> clamp 0.0 1.0
                |> (*) (maximum - minimum)
                |> (+) minimum
                |> roundTo step

        handleMouse done { x } { left } =
            if left then
                toMsg (positionToValue (x - 16)) False

            else
                toMsg value done

        handleTouch posList =
            case posList of
                pos :: _ ->
                    toMsg (positionToValue (pos.x - 16)) True

                _ ->
                    toMsg value True

        background =
            case config.background of
                BackgroundElement bg ->
                    bg

                BackgroundColor c ->
                    defaultBackground c

                BackgroundDefault ->
                    defaultBackground <| Element.rgb 0.9 0.9 0.9
    in
    Element.row []
        [ Element.el
            [ Element.width <| Element.px (widthPx + 32)
            , Element.height <| Element.px heightPx
            , Events.onMouseLeave (toMsg value True)
            , Element.inFront <|
                viewCanvas handleMouse handleTouch (widthPx + 32) heightPx
            ]
            (Element.el
                [ Element.width <| Element.fill
                , Element.height <| Element.fill
                , Element.paddingXY 16 0
                ]
                (viewContent position config.thumbColor background)
            )
        , Element.text <| format config.precision value
        ]


viewCanvas :
    (Bool -> Position -> Buttons -> msg)
    -> (List Position -> msg)
    -> Int
    -> Int
    -> Element.Element msg
viewCanvas toMsgMouse toMsgTouch widthPx heightPx =
    Element.html <|
        Html.canvas
            [ Html.Attributes.style "width" (String.fromInt widthPx ++ "px")
            , Html.Attributes.style "height" (String.fromInt heightPx ++ "px")
            , onMouseEvent "mousedown" (toMsgMouse False)
            , onMouseEvent "mousemove" (toMsgMouse False)
            , onMouseEvent "mouseup" (toMsgMouse True)
            , onTouchEvent "touchstart" toMsgTouch
            , onTouchEvent "touchmove" toMsgTouch
            ]
            []


viewContent :
    Float
    -> Element.Color
    -> Element.Element msg
    -> Element.Element msg
viewContent thumbPos thumbColor background =
    Element.el
        [ Element.width <| Element.fill
        , Element.height <| Element.fill
        , Element.behindContent background
        ]
        (viewThumb thumbPos thumbColor)


viewThumb : Float -> Element.Color -> Element.Element msg
viewThumb posX color =
    Element.el
        [ Border.shadow
            { offset = ( 1.0, 3.0 )
            , size = 2.0
            , blur = 4.0
            , color = Element.rgba 0.0 0.0 0.0 0.3
            }
        , Border.color <| Element.rgb 1.0 1.0 1.0
        , Border.solid
        , Border.widthXY 1 0
        , Background.color color
        , Element.width <| Element.px 6
        , Element.height Element.fill
        , Element.moveRight (posX - 3.0)
        ]
        Element.none
