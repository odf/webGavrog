port module Options exposing (main)

import Html exposing (..)
import Html.Attributes exposing (style, type_, class)
import Html.Events exposing (onClick)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }



-- MODEL


type alias Flags =
    {}


type alias Model =
    { colorByTranslations : Bool
    , skipRelaxation : Bool
    , extraSmooth : Bool
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    Model False False False ! []



-- UPDATE


port send : ( Model, Bool ) -> Cmd msg


type Msg
    = ToggleColorByTranslations
    | ToggleSkipRelaxation
    | ToggleExtraSmooth
    | Send
    | Cancel


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ToggleColorByTranslations ->
            { model
                | colorByTranslations = not model.colorByTranslations
            }
                ! []

        ToggleSkipRelaxation ->
            { model
                | skipRelaxation = not model.skipRelaxation
            }
                ! []

        ToggleExtraSmooth ->
            { model
                | extraSmooth = not model.extraSmooth
            }
                ! []

        Send ->
            ( model, send ( model, True ) )

        Cancel ->
            ( model, send ( model, False ) )



-- VIEW


view : Model -> Html Msg
view model =
    fieldset [ class "form-section" ]
        [ checkbox ToggleColorByTranslations "Color By Translations"
        , checkbox ToggleSkipRelaxation "Skip Relaxation"
        , checkbox ToggleExtraSmooth "Extra-Smooth Faces"
        , p [ class "form-buttons" ]
            [ button [ onClick Send ] [ text "OK" ]
            , button [ onClick Cancel ] [ text "Cancel" ]
            ]
        ]


checkbox : msg -> String -> Html msg
checkbox msg name =
    div
        [ class "form-element"
        ]
        [ label [] [ text name ]
        , input [ type_ "checkbox", onClick msg ] []
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
