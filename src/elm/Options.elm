module Options exposing (Spec, view)

import Element
import Element.Input as Input
import Styling


type alias Spec =
    { key : String
    , label : String
    , value : Bool
    }


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


view : (List Spec -> Maybe Bool -> msg) -> List Spec -> Element.Element msg
view toMsg specs =
    let
        makeCheckbox { key, label, value } =
            checkbox
                (\onOff -> toMsg (toggle onOff key specs) Nothing)
                label
                value
    in
    Element.column [ Element.spacing 16, Element.padding 16 ]
        [ Element.column [ Element.spacing 8 ]
            (List.map makeCheckbox specs)
        , Element.row [ Element.spacing 32, Element.centerX ]
            [ Styling.button (toMsg specs (Just True)) "OK"
            , Styling.button (toMsg specs (Just False)) "Cancel"
            ]
        ]


checkbox : (Bool -> msg) -> String -> Bool -> Element.Element msg
checkbox toMsg label value =
    Input.checkbox []
        { onChange = toMsg
        , icon = Input.defaultCheckbox
        , checked = value
        , label = Input.labelRight [] <| Element.text label
        }
