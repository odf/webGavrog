module ColorDialog exposing (view)

import Color exposing (Color)
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events


type alias Size =
    { widthPx : Int
    , heightPx : Int
    }


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
    let
        pos =
            round (value * 255) - 3
    in
    Element.row
        [ Element.width <| Element.px widthPx
        , Element.height <| Element.px heightPx
        , Events.onMouseDown (toMsg 0.5)
        ]
        [ Element.el
            [ Element.width <| Element.fillPortion (pos - 3) ]
            Element.none
        , Element.el
            [ Border.shadow
                { offset = ( 1.0, 3.0 )
                , size = 2.0
                , blur = 4.0
                , color = Element.rgba 0.0 0.0 0.0 0.3
                }
            , Border.color <| Element.rgb 1.0 1.0 1.0
            , Border.solid
            , Border.widthXY 1 0
            , Element.width <| Element.fillPortion 6
            , Element.height Element.fill
            ]
            Element.none
        , Element.el
            [ Element.width <| Element.fillPortion (252 - pos) ]
            Element.none
        ]


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
            [ Color.hsl (0 / 6) 1.0 0.5
            , Color.hsl (1 / 6) 1.0 0.5
            , Color.hsl (2 / 6) 1.0 0.5
            , Color.hsl (3 / 6) 1.0 0.5
            , Color.hsl (4 / 6) 1.0 0.5
            , Color.hsl (5 / 6) 1.0 0.5
            , Color.hsl (6 / 6) 1.0 0.5
            ]
        , makeSlider
            updateSaturation
            saturation
            [ Color.hsl hue 0.0 0.5
            , Color.hsl hue 1.0 0.5
            ]
        , makeSlider
            updateLightness
            lightness
            [ Color.hsl hue saturation 0.0
            , Color.hsl hue saturation 0.5
            , Color.hsl hue saturation 1.0
            ]
        , makeSlider
            updateAlpha
            alpha
            [ Color.hsla hue saturation lightness 0.0
            , Color.hsla hue saturation lightness 1.0
            ]
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
