module ColorDialog exposing (view)

import Element
import Element.Background as Background
import Element.Border as Border


slider : Int -> Element.Element msg
slider pos =
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


view : Element.Element msg
view =
    Element.column
        [ Element.spacing 16
        , Element.width <| Element.px 200
        ]
        [ Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider 64
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ Element.rgb 1.0 0.0 0.0
                    , Element.rgb 1.0 1.0 0.0
                    , Element.rgb 0.0 1.0 0.0
                    , Element.rgb 0.0 1.0 1.0
                    , Element.rgb 0.0 0.0 1.0
                    , Element.rgb 1.0 0.0 1.0
                    , Element.rgb 1.0 0.0 0.0
                    ]
                }
            ]
            Element.none
        , Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider 192
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ Element.rgb 0.5 0.5 0.5
                    , Element.rgb 0.0 1.0 1.0
                    ]
                }
            ]
            Element.none
        , Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 24
            , Element.inFront <| slider 0
            , Background.gradient
                { angle = pi / 2
                , steps =
                    [ Element.rgb 0.0 0.0 0.0
                    , Element.rgb 0.0 1.0 1.0
                    , Element.rgb 1.0 1.0 1.0
                    ]
                }
            ]
            Element.none
        ]
