module ValueSlider exposing (view)

import Bitwise
import Element
import Element.Background as Background
import Element.Border as Border
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


onMouseDown : (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseDown toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            "mousedown"
            (Decode.map2 toResult decodePos decodeButtons)


onMouseMove : (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseMove toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            "mousemove"
            (Decode.map2 toResult decodePos decodeButtons)


view :
    (Float -> msg)
    -> Size
    -> Element.Color
    -> Element.Element msg
    -> Float
    -> Element.Element msg
view toMsg { widthPx, heightPx } indicatorColor background value =
    let
        mouseOnMain { x, y } { left, right, middle } =
            (if left then
                toFloat x / toFloat widthPx

             else
                value
            )
                |> clamp 0.0 1.0
                |> toMsg

        mouseOnIndicator { x, y } { left, right, middle } =
            (if left then
                value + toFloat (x - 3) / toFloat widthPx

             else
                value
            )
                |> clamp 0.0 1.0
                |> toMsg
    in
    Element.el
        [ Element.width <| Element.px widthPx
        , Element.height <| Element.px heightPx
        , Element.behindContent background
        , onMouseDown mouseOnMain
        , onMouseMove mouseOnMain
        ]
        (Element.el
            [ Border.shadow
                { offset = ( 1.0, 3.0 )
                , size = 2.0
                , blur = 4.0
                , color = Element.rgba 0.0 0.0 0.0 0.3
                }
            , Border.color <| Element.rgb 1.0 1.0 1.0
            , Border.solid
            , Border.widthXY 1 0
            , Background.color indicatorColor
            , Element.width <| Element.px 6
            , Element.height Element.fill
            , Element.moveRight (value * toFloat widthPx - 3.0)
            , onMouseDown mouseOnIndicator
            , onMouseMove mouseOnIndicator
            ]
            Element.none
        )
