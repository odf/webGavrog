module ValueSlider exposing (view)

import Bitwise
import DOM
import Element
import Element.Background as Background
import Element.Border as Border
import Html
import Html.Attributes
import Html.Events
import Html.Events.Extra.Touch as Touch
import Json.Decode as Decode


type alias Size =
    { widthPx : Int
    , heightPx : Int
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


defaultBackground : Element.Element msg
defaultBackground =
    Element.el
        [ Element.centerY
        , Element.width Element.fill
        , Element.height <| Element.px 6
        , Background.color <| Element.rgb 0.9 0.9 0.9
        , Border.innerShadow
            { offset = ( 0.0, 1.0 )
            , size = 1.0
            , blur = 2.0
            , color = Element.rgba 0.0 0.0 0.0 0.5
            }
        ]
        Element.none


format : Int -> Float -> String
format decimals value =
    let
        base =
            10 ^ decimals

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
    sign ++ head ++ "." ++ tail


view :
    (Float -> msg)
    -> Size
    -> Element.Color
    -> Maybe (Element.Element msg)
    -> Float
    -> Element.Element msg
view toMsg { widthPx, heightPx } thumbColor background value =
    let
        newValue x =
            clamp 0.0 1.0 <| toFloat (x - 16) / toFloat widthPx

        handleMouse { x } { left } =
            if left then
                toMsg <| newValue x

            else
                toMsg value

        handleTouch posList =
            case posList of
                pos :: _ ->
                    toMsg <| newValue pos.x

                _ ->
                    toMsg value
    in
    Element.row []
        [ Element.el
            [ Element.width <| Element.px (widthPx + 32)
            , Element.height <| Element.px heightPx
            , Element.inFront <|
                viewCanvas handleMouse handleTouch (widthPx + 32) heightPx
            ]
            (Element.el
                [ Element.width <| Element.fill
                , Element.height <| Element.fill
                , Element.paddingXY 16 0
                ]
                (viewContent
                    (value * toFloat widthPx)
                    thumbColor
                    (Maybe.withDefault defaultBackground background)
                )
            )
        , Element.text <| format 3 value
        ]


viewCanvas :
    (Position -> Buttons -> msg)
    -> (List Position -> msg)
    -> Int
    -> Int
    -> Element.Element msg
viewCanvas toMsgMouse toMsgTouch widthPx heightPx =
    Element.html <|
        Html.canvas
            [ Html.Attributes.style "width" (String.fromInt widthPx ++ "px")
            , Html.Attributes.style "height" (String.fromInt heightPx ++ "px")
            , onMouseEvent "mousedown" toMsgMouse
            , onMouseEvent "mousemove" toMsgMouse
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
