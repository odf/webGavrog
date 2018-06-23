module Options exposing (view, toggle, Spec, Msg(..))

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)


type alias Spec =
    { key : String
    , label : String
    , value : Bool
    }


type Msg
    = Toggle String
    | Submit Bool


toggle : String -> List Spec -> List Spec
toggle key specs =
    List.map
        (\spec ->
            if spec.key == key then
                { spec | value = not spec.value }
            else
                spec
        )
        specs


view : (Msg -> msg) -> List Spec -> Html msg
view toMsg specs =
    div
        [ class "floatable centered infoBox" ]
        [ fieldset [ class "form-section" ]
            (List.map (checkbox toMsg) specs
                ++ [ p [ class "form-buttons" ]
                        [ button
                            [ onClick <| toMsg <| Submit True ]
                            [ text "OK" ]
                        , button
                            [ onClick <| toMsg <| Submit False ]
                            [ text "Cancel" ]
                        ]
                   ]
            )
        ]


checkbox : (Msg -> msg) -> Spec -> Html msg
checkbox toMsg spec =
    div [ class "form-element" ]
        [ label [] [ text spec.label ]
        , input
            [ type_ "checkbox"
            , checked spec.value
            , onClick <| toMsg <| Toggle spec.key
            ]
            []
        ]
