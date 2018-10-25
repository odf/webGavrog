module Options exposing (Msg(..), Spec, toggle, view)

import Element
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
        buttonRow =
            Element.row [ Element.spacing 32, Element.centerX ]
                [ Input.button []
                    { onPress = Just (toMsg <| Submit True)
                    , label = Element.text "OK"
                    }
                , Input.button []
                    { onPress = Just (toMsg <| Submit False)
                    , label = Element.text "Cancel"
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
