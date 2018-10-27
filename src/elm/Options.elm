module Options exposing (Msg(..), Spec, toggle, view)

import Element
import Element.Input as Input
import Styling


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
    Element.column [ Element.spacing 16, Element.padding 16 ]
        [ Element.column [ Element.spacing 8 ]
            (List.map (checkbox toMsg) specs)
        , Element.row [ Element.spacing 32, Element.centerX ]
            [ Styling.button (toMsg <| Submit True) "OK"
            , Styling.button (toMsg <| Submit False) "Cancel"
            ]
        ]


checkbox : (Msg -> msg) -> Spec -> Element.Element msg
checkbox toMsg spec =
    Input.checkbox []
        { onChange = \onOff -> toMsg <| Toggle onOff spec.key
        , icon = Input.defaultCheckbox
        , checked = spec.value
        , label = Input.labelRight [] <| Element.text spec.label
        }
