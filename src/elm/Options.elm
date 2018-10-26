module Options exposing (Msg(..), Spec, toggle, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Font as Font
import Element.Input as Input


type alias Spec =
    { key : String
    , label : String
    , value : Bool
    }


type Msg
    = Toggle Bool String
    | Submit Bool


toggle : Bool -> String -> List Spec -> List Spec
toggle onOff key specs =
    List.map
        (\spec ->
            if spec.key == key then
                { spec | value = onOff }

            else
                spec
        )
        specs


view : (Msg -> msg) -> List Spec -> Element.Element msg
view toMsg specs =
    let
        buttonStyle =
            [ Background.color <| Element.rgb255 140 140 140
            , Font.color <| Element.rgb255 255 255 255
            , Font.semiBold
            , Element.width <| Element.px 96
            , Element.paddingXY 16 8
            , Border.rounded 16
            ]

        buttonText content =
            Element.el [ Element.centerX ] (Element.text content)

        buttonRow =
            Element.row [ Element.spacing 32, Element.centerX ]
                [ Input.button buttonStyle
                    { onPress = Just (toMsg <| Submit True)
                    , label = buttonText "OK"
                    }
                , Input.button buttonStyle
                    { onPress = Just (toMsg <| Submit False)
                    , label = buttonText "Cancel"
                    }
                ]
    in
    Element.column [ Element.spacing 16, Element.padding 16 ]
        [ Element.column [ Element.spacing 8 ]
            (List.map (checkbox toMsg) specs)
        , buttonRow
        ]


checkbox : (Msg -> msg) -> Spec -> Element.Element msg
checkbox toMsg spec =
    Input.checkbox []
        { onChange = \onOff -> toMsg <| Toggle onOff spec.key
        , icon = Input.defaultCheckbox
        , checked = spec.value
        , label = Input.labelRight [] <| Element.text spec.label
        }
