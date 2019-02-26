module ColorDialog exposing (view)

import Color exposing (Color)
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events
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


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = x, y = y })
        (Decode.at [ "offsetX" ] Decode.int)
        (Decode.at [ "offsetY" ] Decode.int)


onMouseDown : (Position -> msg) -> Element.Attribute msg
onMouseDown toMsg =
    let
        toResult pos =
            { message = toMsg pos
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom "mousedown" (Decode.map toResult decodePos)


convertColor : Color -> Element.Color
convertColor color =
    let
        { red, green, blue, alpha } =
            Color.toRgba color
    in
    Element.rgba red green blue alpha


updateHue : Color -> Float -> Color
updateHue color value =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color
    in
    Color.hsla value saturation lightness alpha


updateSaturation : Color -> Float -> Color
updateSaturation color value =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color
    in
    Color.hsla hue value lightness alpha


updateLightness : Color -> Float -> Color
updateLightness color value =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color
    in
    Color.hsla hue saturation value alpha


updateAlpha : Color -> Float -> Color
updateAlpha color value =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color
    in
    Color.hsla hue saturation lightness value


slider : (Float -> msg) -> Size -> Float -> Element.Element msg
slider toMsg { widthPx, heightPx } value =
    Element.el
        [ Element.width <| Element.px widthPx
        , Element.height <| Element.px heightPx
        , onMouseDown (\{ x, y } -> toMsg (toFloat x / toFloat widthPx))
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
            , Element.width <| Element.px 7
            , Element.height Element.fill
            , Element.moveRight (value * toFloat widthPx - toFloat 3)
            ]
            Element.none
        )


view : (Color -> msg) -> Color -> Color -> Element.Element msg
view toMsg oldColor color =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color

        sliderSize =
            { widthPx = 192, heightPx = 24 }

        makeSlider updateColor value colors =
            Element.el
                [ Element.behindContent <|
                    Element.el
                        [ Element.width Element.fill
                        , Element.height Element.fill
                        , Background.gradient
                            { angle = pi / 2
                            , steps = List.map convertColor colors
                            }
                        ]
                        Element.none
                ]
                (slider (updateColor color >> toMsg) sliderSize value)
    in
    Element.column
        [ Element.spacing 12 ]
        [ makeSlider
            updateHue
            hue
            (List.range 0 6
                |> List.map (\i -> Color.hsl (toFloat i / 6) 1.0 0.5)
            )
        , makeSlider
            updateSaturation
            saturation
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color.hsl hue val 0.5)
            )
        , makeSlider
            updateLightness
            lightness
            ([ 0.0, 0.5, 1.0 ]
                |> List.map (\val -> Color.hsl hue saturation val)
            )
        , makeSlider
            updateAlpha
            alpha
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color.hsla hue saturation lightness val)
            )
        , Element.row []
            [ Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                , Background.color <| convertColor oldColor
                ]
                Element.none
            , Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                , Background.color <| convertColor color
                ]
                Element.none
            ]
        ]
