module Options exposing (Spec, Value(..), view, white)

import ColorDialog as CD
import Element as El
import Element.Input as Input
import Styling


type Value
    = Toggle Bool
    | Color CD.Color


type alias Spec =
    { key : String
    , label : String
    , value : Value
    }


white : Value
white =
    Color (CD.Color 0.0 1.0 1.0 1.0)


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


view : (List Spec -> Maybe Bool -> msg) -> List Spec -> El.Element msg
view toMsg specs =
    let
        viewItem spec =
            viewOption
                (\val -> toMsg (update val spec.key specs) Nothing)
                spec
    in
    El.column [ El.spacing 16, El.padding 16 ]
        [ El.column [ El.spacing 8 ]
            (List.map viewItem specs)
        , El.row [ El.spacing 32, El.centerX ]
            [ Styling.button (toMsg specs (Just True)) "OK"
            , Styling.button (toMsg specs (Just False)) "Cancel"
            ]
        ]


viewOption : (Value -> msg) -> Spec -> El.Element msg
viewOption toMsg { label, value } =
    case value of
        Toggle onOff ->
            viewToggle (Toggle >> toMsg) label onOff

        Color color ->
            viewColor (Color >> toMsg) label color


viewToggle : (Bool -> msg) -> String -> Bool -> El.Element msg
viewToggle toMsg label onOff =
    Input.checkbox []
        { onChange = toMsg
        , icon = Input.defaultCheckbox
        , checked = onOff
        , label = Input.labelRight [] <| El.text label
        }


viewColor : (CD.Color -> msg) -> String -> CD.Color -> El.Element msg
viewColor toMsg label color =
    El.column [ El.spacing 16, El.padding 16 ]
        [ El.text label
        , CD.view toMsg color color
        ]
