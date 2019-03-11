module Styling exposing
    ( backgroundColor
    , borderColor
    , button
    , logoText
    , navIcon
    )

import Element as El
import Element.Background as Background
import Element.Border as Border
import Element.Font as Font
import Element.Input as Input


backgroundColor : El.Color
backgroundColor =
    El.rgb255 255 244 210


borderColor : El.Color
borderColor =
    El.rgb255 221 175 44


button : msg -> String -> El.Element msg
button toMsg text =
    Input.button
        [ Background.color <| El.rgb255 140 140 140
        , Font.color <| El.rgb255 255 255 255
        , Font.semiBold
        , El.width <| El.px 96
        , El.paddingXY 16 8
        , Border.rounded 16
        ]
        { onPress = Just toMsg
        , label = El.el [ El.centerX ] (El.text text)
        }


logoText : String -> El.Element msg
logoText text =
    El.el
        [ Font.size 28
        , Font.color <| El.rgb255 0 0 139
        , Font.variant Font.smallCaps
        , Font.semiBold
        ]
        (El.text text)


navIcon : El.Element msg
navIcon =
    El.el
        [ Font.size 24
        , Font.bold
        , Font.color <| El.rgb255 140 140 140
        , El.padding 8
        ]
        (El.text "☰")
