module ValueSlider exposing (view)

import Bitwise
import Element
import Element.Background as Background
import Element.Border as Border
import Html
import Html.Attributes
import Html.Events
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


onMouseEvent : String -> (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseEvent eventString toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            eventString
            (Decode.map2 toResult decodePos decodeButtons)


onMouseDown : (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseDown =
    onMouseEvent "mousedown"


onMouseMove : (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseMove =
    onMouseEvent "mousemove"


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
        handleMouse { x } { left } =
            if left then
                toMsg <| clamp 0.0 1.0 <| toFloat (x - 16) / toFloat widthPx

            else
                toMsg value
    in
    Element.row []
        [ Element.el
            [ Element.width <| Element.px (widthPx + 32)
            , Element.height <| Element.px heightPx
            , onMouseDown handleMouse
            , onMouseMove handleMouse
            , Element.inFront <| viewCanvas (widthPx + 32) heightPx
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


viewCanvas : Int -> Int -> Element.Element msg
viewCanvas widthPx heightPx =
    Element.html <|
        Html.canvas
            [ Html.Attributes.style "width" (String.fromInt widthPx ++ "px")
            , Html.Attributes.style "height" (String.fromInt heightPx ++ "px")
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
