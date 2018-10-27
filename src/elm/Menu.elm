module Menu exposing (Config, State, view)

import Html exposing (Html)
import Html.Attributes as Attributes
import Html.Events as Events



-- MODEL


type alias Config msg =
    { label : String
    , items : List String
    , activate : Bool -> msg
    , activateItem : Maybe ( Int, String ) -> msg
    , selectCurrentItem : msg
    }


type alias State =
    { visible : Bool
    , active : Maybe Int
    }



-- VIEW


view : Config msg -> State -> Html msg
view config state =
    let
        maybeMenu =
            if state.visible then
                [ Html.ul [ Attributes.class "menuList" ]
                    (List.indexedMap (viewItem config state) config.items)
                ]

            else
                []
    in
    Html.ul
        [ Attributes.class "menuWrapper" ]
        [ Html.li
            [ Attributes.class "menuTop"
            , Events.onMouseEnter <| config.activate True
            , Events.onMouseLeave <| config.activate False
            ]
            ([ Html.text config.label ] ++ maybeMenu)
        ]


viewItem : Config msg -> State -> Int -> String -> Html msg
viewItem config state index label =
    if label == "--" then
        Html.li [ Attributes.class "menuSeparator" ] []

    else
        Html.li
            [ Attributes.classList
                [ ( "menuItem", True )
                , ( "menuActive", state.active == Just index )
                ]
            , Events.onMouseEnter <| config.activateItem (Just ( index, label ))
            , Events.onMouseLeave <| config.activateItem Nothing
            , Events.onClick config.selectCurrentItem
            ]
            [ Html.text label ]
