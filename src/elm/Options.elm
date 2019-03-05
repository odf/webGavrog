module Options exposing (Spec, Value(..), view)

import ColorDialog exposing (Color)
import Element
import Element.Input as Input
import Styling


type Value
    = Toggle Bool
    | Color Color


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
        viewItem spec =
            viewOption
                (\val -> toMsg (update val spec.key specs) Nothing)
                spec
    in
    Element.column [ Element.spacing 16, Element.padding 16 ]
        [ Element.column [ Element.spacing 8 ]
            (List.map viewItem specs)
        , Element.row [ Element.spacing 32, Element.centerX ]
            [ Styling.button (toMsg specs (Just True)) "OK"
            , Styling.button (toMsg specs (Just False)) "Cancel"
            ]
        ]


viewOption : (Value -> msg) -> Spec -> Element.Element msg
viewOption toMsg { label, value } =
    case value of
        Toggle onOff ->
            checkbox (Toggle >> toMsg) label onOff

        Color color ->
            ColorDialog.view (Color >> toMsg) color color


checkbox : (Bool -> msg) -> String -> Bool -> Element.Element msg
checkbox toMsg label value =
    Input.checkbox []
        { onChange = toMsg
        , icon = Input.defaultCheckbox
        , checked = value
        , label = Input.labelRight [] <| Element.text label
        }
