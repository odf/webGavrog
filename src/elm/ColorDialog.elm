module ColorDialog exposing (view)

import Color exposing (Color)
import Element
import Element.Background as Background
import Element.Border as Border


convertColor : Color -> Element.Color
convertColor color =
    let
        { red, green, blue, alpha } =
            Color.toRgba color
    in
    Element.rgba red green blue alpha


slider : Float -> Element.Element msg
slider value =
    let
        pos =
            round (value * 255) - 3
    in
    Element.row
        [ Element.width Element.fill
        , Element.height Element.fill
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


view : Color -> Color -> Element.Element msg
view oldColor color =
    let
        { hue, saturation, lightness, alpha } =
            Color.toHsla color
    in
    Element.column
        [ Element.spacing 12
        , Element.width <| Element.px 192
        ]
        [ Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider hue
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ convertColor <| Color.hsl (0 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (1 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (2 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (3 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (4 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (5 / 6) 1.0 0.5
                    , convertColor <| Color.hsl (6 / 6) 1.0 0.5
                    ]
                }
            ]
            Element.none
        , Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider saturation
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ convertColor <| Color.hsl hue 0.0 0.5
                    , convertColor <| Color.hsl hue 1.0 0.5
                    ]
                }
            ]
            Element.none
        , Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider lightness
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ convertColor <| Color.hsl hue saturation 0.0
                    , convertColor <| Color.hsl hue saturation 0.5
                    , convertColor <| Color.hsl hue saturation 1.0
                    ]
                }
            ]
            Element.none
        , Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider alpha
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ convertColor <| Color.hsla hue saturation lightness 0.0
                    , convertColor <| Color.hsla hue saturation lightness 1.0
                    ]
                }
            ]
            Element.none
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
