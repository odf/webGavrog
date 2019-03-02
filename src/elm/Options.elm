module Options exposing (Spec, Value(..), view)

import Element
import Element.Input as Input
import Styling


type Value
    = Toggle Bool


type alias Spec =
    { key : String
    , label : String
    , value : Value
    }


update : Value -> String -> List Spec -> List Spec
update value key specs =
    List.map
        (\spec ->
            if spec.key == key then
                { spec | value = value }

            else
                spec
        )
        specs


view : (List Spec -> Maybe Bool -> msg) -> List Spec -> Element.Element msg
view toMsg specs =
    let
        viewOption { key, label, value } =
            case value of
                Toggle onOff ->
                    checkbox
                        (\val -> toMsg (update (Toggle val) key specs) Nothing)
                        label
                        onOff
    in
    Element.column [ Element.spacing 16, Element.padding 16 ]
        [ Element.column [ Element.spacing 8 ]
            (List.map viewOption specs)
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
