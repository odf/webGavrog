port module Options exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
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


type alias Flags =
    Model


init : Flags -> ( Model, Cmd Msg )
init flags =
    flags ! []



-- UPDATE


port send : ( Model, Bool ) -> Cmd msg


type Msg
    = Toggle String
    | Send
    | Cancel


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

        Send ->
            ( model, send ( model, True ) )

        Cancel ->
            ( model, send ( model, False ) )



-- VIEW


view : Model -> Html Msg
view model =
    fieldset [ class "form-section" ]
        (List.map checkbox model
            ++ [ p [ class "form-buttons" ]
                    [ button [ onClick Send ] [ text "OK" ]
                    , button [ onClick Cancel ] [ text "Cancel" ]
                    ]
               ]
        )


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



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
