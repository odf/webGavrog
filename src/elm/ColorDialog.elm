module ColorDialog exposing (view)

import Color exposing (Color)
import Element
import Element.Background as Background
import ValueSlider


checkerboard : String
checkerboard =
    "data:image/png;base64,"
        ++ "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAsT"
        ++ "AAALEwEAmpwYAAAAB3RJTUUH4wIbBzEcds8NCgAAAB1pVFh0Q29tbWVudAAA"
        ++ "AAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAKklEQVQoz2Ps6OhgwAbKy8ux"
        ++ "ijMxkAhGNRADGP///49VorOzczSU6KcBAAveB7RweqHLAAAAAElFTkSuQmCC"


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


sliderBackground : List Color -> Element.Element msg
sliderBackground colors =
    Element.el
        [ Element.width Element.fill
        , Element.height Element.fill
        , Background.tiled checkerboard
        , Element.inFront
            (Element.el
                [ Element.width Element.fill
                , Element.height Element.fill
                , Background.gradient
                    { angle = pi / 2
                    , steps = List.map convertColor colors
                    }
                ]
                Element.none
            )
        ]
        Element.none


view : (Color -> msg) -> Color -> Color -> Element.Element msg
view toMsg oldColor color =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color

        makeSlider updateColor value icolor colors =
            ValueSlider.view
                (updateColor color >> toMsg)
                { widthPx = 192, heightPx = 24 }
                (convertColor icolor)
                (sliderBackground colors)
                value
    in
    Element.column
        [ Element.spacing 12 ]
        [ makeSlider
            updateHue
            hue
            (Color.hsl hue 1.0 0.5)
            (List.range 0 6
                |> List.map (\i -> Color.hsl (toFloat i / 6) 1.0 0.5)
            )
        , makeSlider
            updateSaturation
            saturation
            (Color.hsl hue saturation 0.5)
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color.hsl hue val 0.5)
            )
        , makeSlider
            updateLightness
            lightness
            (Color.hsl hue saturation lightness)
            ([ 0.0, 0.5, 1.0 ]
                |> List.map (\val -> Color.hsl hue saturation val)
            )
        , makeSlider
            updateAlpha
            alpha
            (Color.hsla hue saturation lightness alpha)
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color.hsla hue saturation lightness val)
            )
        , Element.row []
            [ Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                , Background.tiled checkerboard
                , Element.inFront
                    (Element.el
                        [ Element.width Element.fill
                        , Element.height Element.fill
                        , Background.color <| convertColor oldColor
                        ]
                        Element.none
                    )
                ]
                Element.none
            , Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                , Background.tiled checkerboard
                , Element.inFront
                    (Element.el
                        [ Element.width Element.fill
                        , Element.height Element.fill
                        , Background.color <| convertColor color
                        ]
                        Element.none
                    )
                ]
                Element.none
            ]
        ]
