module ColorDialog exposing (Color, view)

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


view : (Color -> msg) -> Color -> Color -> Element.Element msg
view toMsg oldColor color =
    let
        { hue, saturation, lightness, alpha } =
            color

        makeSlider updateColor value icolor colors =
            ValueSlider.view
                (updateColor color >> toMsg)
                { widthPx = 192, heightPx = 24 }
                (toElementColor icolor)
                (colorField colors)
                value
    in
    Element.column
        [ Element.spacing 12 ]
        [ makeSlider
            updateHue
            hue
            (Color hue 1.0 0.5 1.0)
            (List.range 0 6
                |> List.map (\i -> Color (toFloat i / 6) 1.0 0.5 1.0)
            )
        , makeSlider
            updateSaturation
            saturation
            (Color hue saturation 0.5 1.0)
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color hue val 0.5 1.0)
            )
        , makeSlider
            updateLightness
            lightness
            (Color hue saturation lightness 1.0)
            ([ 0.0, 0.5, 1.0 ]
                |> List.map (\val -> Color hue saturation val 1.0)
            )
        , makeSlider
            updateAlpha
            alpha
            (Color hue saturation lightness alpha)
            ([ 0.0, 1.0 ]
                |> List.map (\val -> Color hue saturation lightness val)
            )
        , Element.row []
            [ Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                ]
                (colorField [ oldColor ])
            , Element.el
                [ Element.width <| Element.px 96
                , Element.height <| Element.px 48
                ]
                (colorField [ color ])
            ]
        ]
