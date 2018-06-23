port module Options exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = \_ -> Sub.none
        , update = update
        }



-- MODEL


type alias Spec =
    { key : String
    , label : String
    , value : Bool
    }


type alias Model =
    List Spec


init : Model -> ( Model, Cmd Msg )
init options =
    options ! []



-- UPDATE


port send : ( Model, Bool ) -> Cmd msg


type Msg
    = Toggle String
    | Submit Bool


toggleIfKey : String -> Spec -> Spec
toggleIfKey key spec =
    if spec.key == key then
        { spec | value = not spec.value }
    else
        spec


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Toggle key ->
            List.map (toggleIfKey key) model ! []

        Submit ok ->
            ( model, send ( model, ok ) )



-- VIEW


view : Model -> Html Msg
view model =
    div
        [ class "floatable centered infoBox" ]
        [ fieldset [ class "form-section" ]
            (List.map checkbox model
                ++ [ p [ class "form-buttons" ]
                        [ button [ onClick (Submit True) ] [ text "OK" ]
                        , button [ onClick (Submit False) ] [ text "Cancel" ]
                        ]
                   ]
            )
        ]


checkbox : Spec -> Html Msg
checkbox spec =
    div [ class "form-element" ]
        [ label [] [ text spec.label ]
        , input
            [ type_ "checkbox"
            , checked spec.value
            , onClick (Toggle spec.key)
            ]
            []
        ]
