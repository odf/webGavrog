module ColorDialog exposing (Color, colorField, view)

import Color as ElmColor
import Element
import Element.Background as Background
import ValueSlider


type alias Color =
    { hue : Float
    , saturation : Float
    , lightness : Float
    , alpha : Float
    }


updateHue : Color -> Float -> Color
updateHue color value =
    { color | hue = clamp 0.0 1.0 value }


updateSaturation : Color -> Float -> Color
updateSaturation color value =
    { color | saturation = clamp 0.0 1.0 value }


updateLightness : Color -> Float -> Color
updateLightness color value =
    { color | lightness = clamp 0.0 1.0 value }


updateAlpha : Color -> Float -> Color
updateAlpha color value =
    { color | alpha = clamp 0.0 1.0 value }


toElementColor : Color -> Element.Color
toElementColor color =
    let
        { hue, saturation, lightness, alpha } =
            color

        { red, green, blue } =
            ElmColor.toRgba <| ElmColor.hsl hue saturation lightness
    in
    Element.rgba red green blue alpha


checkerboard : String
checkerboard =
    "data:image/png;base64,"
        ++ "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAsT"
        ++ "AAALEwEAmpwYAAAAB3RJTUUH4wIbBzEcds8NCgAAAB1pVFh0Q29tbWVudAAA"
        ++ "AAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAKklEQVQoz2Ps6OhgwAbKy8ux"
        ++ "ijMxkAhGNRADGP///49VorOzczSU6KcBAAveB7RweqHLAAAAAElFTkSuQmCC"


colorField : List Color -> Element.Element msg
colorField colors =
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
                    , steps = List.map toElementColor colors
                    }
                ]
                Element.none
            )
        ]
        Element.none


view : (Color -> Bool -> msg) -> Color -> Bool -> Element.Element msg
view toMsg color includeAlpha =
    let
        { hue, saturation, lightness, alpha } =
            color

        makeSlider updateColor value icolor colors =
            ValueSlider.view
                (updateColor color >> toMsg)
                { minimum = 0.0
                , maximum = 1.0
                , step = Nothing
                , precision = 3
                , widthPx = 200
                , heightPx = 24
                , thumbColor = toElementColor icolor
                , background =
                    ValueSlider.BackgroundElement <| colorField colors
                }
                value

        hueSlider =
            makeSlider
                updateHue
                hue
                (Color hue 1.0 0.5 1.0)
                (List.range 0 6
                    |> List.map (\i -> Color (toFloat i / 6) 1.0 0.5 1.0)
                )

        saturationSlider =
            makeSlider
                updateSaturation
                saturation
                (Color hue saturation 0.5 1.0)
                ([ 0.0, 1.0 ]
                    |> List.map (\val -> Color hue val 0.5 1.0)
                )

        lightnessSlider =
            makeSlider
                updateLightness
                lightness
                (Color hue saturation lightness 1.0)
                ([ 0.0, 0.5, 1.0 ]
                    |> List.map (\val -> Color hue saturation val 1.0)
                )

        alphaSlider =
            makeSlider
                updateAlpha
                alpha
                (Color hue saturation lightness alpha)
                ([ 0.0, 1.0 ]
                    |> List.map (\val -> Color hue saturation lightness val)
                )
    in
    Element.column
        [ Element.spacing 12 ]
        (if includeAlpha then
            [ hueSlider, saturationSlider, lightnessSlider, alphaSlider ]

         else
            [ hueSlider, saturationSlider, lightnessSlider ]
        )
